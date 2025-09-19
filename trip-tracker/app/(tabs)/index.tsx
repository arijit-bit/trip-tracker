import React, { useEffect, useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  SafeAreaView,
} from 'react-native';
import MapView, { Polyline } from 'react-native-maps';
import * as Location from 'expo-location';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Types
interface LocationCoords {
  latitude: number;
  longitude: number;
  timestamp: number;
  speed?: number;
}

interface Trip {
  id: string;
  startTime: number;
  endTime: number;
  path: LocationCoords[];
  distance: number;
  duration: number;
  averageSpeed: number;
}

export default function TripTrackerScreen() {
  const [location, setLocation] = useState<Location.LocationObject | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isTracking, setIsTracking] = useState(false);
  const [currentPath, setCurrentPath] = useState<LocationCoords[]>([]);
  const [speed, setSpeed] = useState(0);
  const [tripStartTime, setTripStartTime] = useState<number | null>(null);
  const [distance, setDistance] = useState(0);

  const mapRef = useRef<MapView | null>(null);
  const locationWatcher = useRef<Location.LocationSubscription | null>(null);

  // Calculate distance between two coordinates
  const calculateDistance = (coord1: LocationCoords, coord2: LocationCoords): number => {
    const R = 6371e3; // Earth's radius in meters
    const φ1 = (coord1.latitude * Math.PI) / 180;
    const φ2 = (coord2.latitude * Math.PI) / 180;
    const Δφ = ((coord2.latitude - coord1.latitude) * Math.PI) / 180;
    const Δλ = ((coord2.longitude - coord1.longitude) * Math.PI) / 180;

    const a =
      Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
      Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c;
  };

  // Start location tracking
  const startLocationTracking = async () => {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') {
      setErrorMsg('Permission to access location was denied');
      return;
    }

    locationWatcher.current = await Location.watchPositionAsync(
      {
        accuracy: Location.Accuracy.BestForNavigation,
        timeInterval: 1000, // every 1 sec
        distanceInterval: 1, // every 1 meter
      },
      (loc) => {
        setLocation(loc);

        if (isTracking) {
          const newPoint: LocationCoords = {
            latitude: loc.coords.latitude,
            longitude: loc.coords.longitude,
            timestamp: loc.timestamp,
          };

          setCurrentPath(prev => {
            if (prev.length > 0) {
              const lastPoint = prev[prev.length - 1];
              const distanceIncrement = calculateDistance(lastPoint, newPoint);
              const timeDiff = (newPoint.timestamp - lastPoint.timestamp) / 1000;

              // ✅ Update distance safely
              setDistance(prevDistance => prevDistance + distanceIncrement);

              // ✅ Calculate speed manually (m/s)
              if (timeDiff > 0) {
                setSpeed(distanceIncrement / timeDiff);
              }
            }
            return [...prev, newPoint];
          });
        }
      }
    );

  };

  // Start trip tracking
  const startTrip = () => {
    if (!location) {
      Alert.alert('Error', 'Location not available yet');
      return;
    }

    setIsTracking(true);
    setTripStartTime(Date.now());
    setCurrentPath([{
      latitude: location.coords.latitude,
      longitude: location.coords.longitude,
      timestamp: location.timestamp,
      speed: location.coords.speed ? Math.max(0, location.coords.speed) : 0,
    }]);
    setDistance(0);
  };

  // Stop trip tracking and save
  const stopTrip = async () => {
    if (!isTracking || !tripStartTime) return;

    setIsTracking(false);
    const endTime = Date.now();
    const duration = (endTime - tripStartTime) / 1000; // in seconds
    const averageSpeed = duration > 0 ? distance / duration : 0;

    const trip: Trip = {
      id: Date.now().toString(),
      startTime: tripStartTime,
      endTime,
      path: currentPath,
      distance,
      duration,
      averageSpeed,
    };

    try {
      // Save trip to AsyncStorage
      const existingTrips = await AsyncStorage.getItem('trips');
      const trips = existingTrips ? JSON.parse(existingTrips) : [];
      trips.push(trip);
      await AsyncStorage.setItem('trips', JSON.stringify(trips));

      Alert.alert(
        'Trip Saved!',
        `Distance: ${(distance / 1000).toFixed(2)} km\nDuration: ${formatDuration(duration)}\nAvg Speed: ${(averageSpeed * 3.6).toFixed(1)} km/h`
      );
    } catch (error) {
      console.error('Error saving trip:', error);
      Alert.alert('Error', 'Failed to save trip');
    }

    // Reset state
    setCurrentPath([]);
    setTripStartTime(null);
    setDistance(0);
  };

  // Format duration
  const formatDuration = (seconds: number): string => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);

    if (hours > 0) {
      return `${hours}h ${minutes}m ${secs}s`;
    } else if (minutes > 0) {
      return `${minutes}m ${secs}s`;
    } else {
      return `${secs}s`;
    }
  };

  // Format speed
  const getFormattedSpeed = () => {
    if (speed < 0.1) {
      return '0.0 km/h';
    }
    return `${(speed * 3.6).toFixed(1)} km/h`;
  };

  // Initialize location tracking
  useEffect(() => {
    startLocationTracking();

    return () => {
      if (locationWatcher.current) {
        locationWatcher.current.remove();
      }
    };
  }, []);

  if (errorMsg) {
    return (
      <SafeAreaView style={styles.center}>
        <Text style={styles.errorText}>{errorMsg}</Text>
      </SafeAreaView>
    );
  }

  if (!location) {
    return (
      <SafeAreaView style={styles.center}>
        <Text style={styles.loadingText}>Getting your location...</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Control Button */}
      <View style={styles.buttonContainer}>
        <TouchableOpacity
          style={[
            styles.controlButton,
            isTracking ? styles.stopButton : styles.startButton,
          ]}
          onPress={isTracking ? stopTrip : startTrip}
        >
          <Text style={styles.buttonText}>
            {isTracking ? '🛑 Stop Tracking' : '🚀 Start Tracking'}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Map */}
      <MapView
        ref={mapRef}
        style={styles.map}
        region={{
          latitude: location.coords.latitude,
          longitude: location.coords.longitude,
          latitudeDelta: 0.005,
          longitudeDelta: 0.005,
        }}
        showsUserLocation
        followsUserLocation
      >
        {/* Draw path if tracking */}
        {currentPath.length > 1 && (
          <Polyline
            coordinates={currentPath.map(point => ({
              latitude: point.latitude,
              longitude: point.longitude,
            }))}
            strokeColor="#007AFF"
            strokeWidth={4}
            lineCap="round"
            lineJoin="round"
          />
        )}
      </MapView>

      {/* Info Overlay */}
      <View style={styles.overlay}>
        <Text style={styles.statusText}>
          {isTracking ? '🟢 Tracking Active' : '🔴 Not Tracking'}
        </Text>
        <Text style={styles.text}>Speed: {getFormattedSpeed()}</Text>
        {isTracking && (
          <>
            <Text style={styles.text}>
              Distance: {(distance / 1000).toFixed(2)} km
            </Text>
            <Text style={styles.text}>
              Duration: {tripStartTime ? formatDuration((Date.now() - tripStartTime) / 1000) : '0s'}
            </Text>
            <Text style={styles.text}>
              Points: {currentPath.length}
            </Text>
          </>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  map: {
    flex: 1,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  errorText: {
    color: 'red',
    fontSize: 16,
    textAlign: 'center',
  },
  loadingText: {
    color: '#666',
    fontSize: 16,
    textAlign: 'center',
  },
  buttonContainer: {
    position: 'absolute',
    top: 60,
    left: 20,
    right: 20,
    zIndex: 1000,
  },
  controlButton: {
    paddingVertical: 15,
    paddingHorizontal: 30,
    borderRadius: 25,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  startButton: {
    backgroundColor: '#4CAF50',
  },
  stopButton: {
    backgroundColor: '#f44336',
  },
  buttonText: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
  },
  overlay: {
    position: 'absolute',
    bottom: 50,
    left: 20,
    right: 20,
    backgroundColor: 'rgba(0,0,0,0.8)',
    padding: 20,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  statusText: {
    color: 'white',
    fontSize: 20,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 10,
  },
  text: {
    color: 'white',
    fontSize: 16,
    textAlign: 'center',
    marginVertical: 3,
  },
});
