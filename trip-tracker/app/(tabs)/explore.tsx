import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  SafeAreaView,
  Modal,
  Alert,
} from 'react-native';
import MapView, { Polyline, Marker } from 'react-native-maps';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect } from '@react-navigation/native';

// Types (same as in main screen)
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

export default function TripHistoryScreen() {
  const [trips, setTrips] = useState<Trip[]>([]);
  const [selectedTrip, setSelectedTrip] = useState<Trip | null>(null);
  const [modalVisible, setModalVisible] = useState(false);

  // Load trips from storage
  const loadTrips = async () => {
    try {
      const storedTrips = await AsyncStorage.getItem('trips');
      if (storedTrips) {
        const parsedTrips = JSON.parse(storedTrips);
        // Sort by most recent first
        parsedTrips.sort((a: Trip, b: Trip) => b.startTime - a.startTime);
        setTrips(parsedTrips);
      }
    } catch (error) {
      console.error('Error loading trips:', error);
    }
  };

  // Refresh trips when screen is focused
  useFocusEffect(
    useCallback(() => {
      loadTrips();
    }, [])
  );

  // Format date
  const formatDate = (timestamp: number): string => {
    const date = new Date(timestamp);
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  // Format duration
  const formatDuration = (seconds: number): string => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    
    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    } else if (minutes > 0) {
      return `${minutes}m ${secs}s`;
    } else {
      return `${secs}s`;
    }
  };

  // Delete trip
  const deleteTrip = async (tripId: string) => {
    Alert.alert(
      'Delete Trip',
      'Are you sure you want to delete this trip?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              const updatedTrips = trips.filter(trip => trip.id !== tripId);
              await AsyncStorage.setItem('trips', JSON.stringify(updatedTrips));
              setTrips(updatedTrips);
            } catch (error) {
              console.error('Error deleting trip:', error);
            }
          },
        },
      ]
    );
  };

  // Clear all trips
  const clearAllTrips = () => {
    Alert.alert(
      'Clear All Trips',
      'Are you sure you want to delete all trips? This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear All',
          style: 'destructive',
          onPress: async () => {
            try {
              await AsyncStorage.removeItem('trips');
              setTrips([]);
            } catch (error) {
              console.error('Error clearing trips:', error);
            }
          },
        },
      ]
    );
  };

  // View trip on map
  const viewTripOnMap = (trip: Trip) => {
    setSelectedTrip(trip);
    setModalVisible(true);
  };

  // Get map region for trip
  const getTripMapRegion = (path: LocationCoords[]) => {
    if (path.length === 0) return null;

    const latitudes = path.map(p => p.latitude);
    const longitudes = path.map(p => p.longitude);
    
    const minLat = Math.min(...latitudes);
    const maxLat = Math.max(...latitudes);
    const minLng = Math.min(...longitudes);
    const maxLng = Math.max(...longitudes);
    
    const centerLat = (minLat + maxLat) / 2;
    const centerLng = (minLng + maxLng) / 2;
    const deltaLat = (maxLat - minLat) * 1.2; // Add some padding
    const deltaLng = (maxLng - minLng) * 1.2;
    
    return {
      latitude: centerLat,
      longitude: centerLng,
      latitudeDelta: Math.max(deltaLat, 0.001),
      longitudeDelta: Math.max(deltaLng, 0.001),
    };
  };

  // Render trip item
  const renderTripItem = ({ item }: { item: Trip }) => (
    <TouchableOpacity
      style={styles.tripItem}
      onPress={() => viewTripOnMap(item)}
    >
      <View style={styles.tripHeader}>
        <Text style={styles.tripDate}>{formatDate(item.startTime)}</Text>
        <TouchableOpacity
          style={styles.deleteButton}
          onPress={() => deleteTrip(item.id)}
        >
          <Text style={styles.deleteButtonText}>🗑️</Text>
        </TouchableOpacity>
      </View>
      
      <View style={styles.tripStats}>
        <View style={styles.statItem}>
          <Text style={styles.statLabel}>Distance</Text>
          <Text style={styles.statValue}>{(item.distance / 1000).toFixed(2)} km</Text>
        </View>
        
        <View style={styles.statItem}>
          <Text style={styles.statLabel}>Duration</Text>
          <Text style={styles.statValue}>{formatDuration(item.duration)}</Text>
        </View>
        
        <View style={styles.statItem}>
          <Text style={styles.statLabel}>Avg Speed</Text>
          <Text style={styles.statValue}>{(item.averageSpeed * 3.6).toFixed(1)} km/h</Text>
        </View>
      </View>
      
      <View style={styles.tripFooter}>
        <Text style={styles.pathPoints}>{item.path.length} GPS points</Text>
        <Text style={styles.viewMapText}>Tap to view on map</Text>
      </View>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Trip History</Text>
        {trips.length > 0 && (
          <TouchableOpacity
            style={styles.clearButton}
            onPress={clearAllTrips}
          >
            <Text style={styles.clearButtonText}>Clear All</Text>
          </TouchableOpacity>
        )}
      </View>

      {trips.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyStateIcon}>🚗</Text>
          <Text style={styles.emptyStateTitle}>No trips yet</Text>
          <Text style={styles.emptyStateText}>
            Start tracking a trip to see your journey history here
          </Text>
        </View>
      ) : (
        <FlatList
          data={trips}
          renderItem={renderTripItem}
          keyExtractor={item => item.id}
          style={styles.list}
          showsVerticalScrollIndicator={false}
        />
      )}

      {/* Trip Map Modal */}
      <Modal
        visible={modalVisible}
        animationType="slide"
        presentationStyle="pageSheet"
      >
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity
              style={styles.closeButton}
              onPress={() => setModalVisible(false)}
            >
              <Text style={styles.closeButtonText}>✕ Close</Text>
            </TouchableOpacity>
            <Text style={styles.modalTitle}>
              {selectedTrip ? formatDate(selectedTrip.startTime) : ''}
            </Text>
          </View>

          {selectedTrip && (
            <>
              <MapView
                style={styles.modalMap}
                region={getTripMapRegion(selectedTrip.path)}
              >
                {/* Draw trip path */}
                {selectedTrip.path.length > 1 && (
                  <Polyline
                    coordinates={selectedTrip.path.map(point => ({
                      latitude: point.latitude,
                      longitude: point.longitude,
                    }))}
                    strokeColor="#007AFF"
                    strokeWidth={4}
                    lineCap="round"
                    lineJoin="round"
                  />
                )}
                
                {/* Start marker */}
                {selectedTrip.path.length > 0 && (
                  <Marker
                    coordinate={{
                      latitude: selectedTrip.path[0].latitude,
                      longitude: selectedTrip.path[0].longitude,
                    }}
                    title="Start"
                    pinColor="green"
                  />
                )}
                
                {/* End marker */}
                {selectedTrip.path.length > 1 && (
                  <Marker
                    coordinate={{
                      latitude: selectedTrip.path[selectedTrip.path.length - 1].latitude,
                      longitude: selectedTrip.path[selectedTrip.path.length - 1].longitude,
                    }}
                    title="End"
                    pinColor="red"
                  />
                )}
              </MapView>
              
              <View style={styles.modalStats}>
                <View style={styles.modalStatItem}>
                  <Text style={styles.modalStatLabel}>Distance</Text>
                  <Text style={styles.modalStatValue}>{(selectedTrip.distance / 1000).toFixed(2)} km</Text>
                </View>
                <View style={styles.modalStatItem}>
                  <Text style={styles.modalStatLabel}>Duration</Text>
                  <Text style={styles.modalStatValue}>{formatDuration(selectedTrip.duration)}</Text>
                </View>
                <View style={styles.modalStatItem}>
                  <Text style={styles.modalStatLabel}>Avg Speed</Text>
                  <Text style={styles.modalStatValue}>{(selectedTrip.averageSpeed * 3.6).toFixed(1)} km/h</Text>
                </View>
              </View>
            </>
          )}
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 15,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
  },
  clearButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: '#ff4444',
    borderRadius: 6,
  },
  clearButtonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  emptyStateIcon: {
    fontSize: 64,
    marginBottom: 20,
  },
  emptyStateTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#666',
    marginBottom: 10,
  },
  emptyStateText: {
    fontSize: 16,
    color: '#999',
    textAlign: 'center',
    lineHeight: 24,
  },
  list: {
    flex: 1,
    paddingHorizontal: 20,
  },
  tripItem: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    marginVertical: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  tripHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  tripDate: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
  },
  deleteButton: {
    padding: 4,
  },
  deleteButtonText: {
    fontSize: 18,
  },
  tripStats: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  statItem: {
    alignItems: 'center',
  },
  statLabel: {
    fontSize: 12,
    color: '#666',
    marginBottom: 4,
  },
  statValue: {
    fontSize: 16,
    fontWeight: '600',
    color: '#007AFF',
  },
  tripFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
    paddingTop: 12,
  },
  pathPoints: {
    fontSize: 12,
    color: '#999',
  },
  viewMapText: {
    fontSize: 12,
    color: '#007AFF',
    fontWeight: '500',
  },
  modalContainer: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 15,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  closeButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: '#007AFF',
    borderRadius: 6,
  },
  closeButtonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
  },
  modalMap: {
    flex: 1,
  },
  modalStats: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    backgroundColor: 'white',
    paddingVertical: 20,
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
  },
  modalStatItem: {
    alignItems: 'center',
  },
  modalStatLabel: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4,
  },
  modalStatValue: {
    fontSize: 18,
    fontWeight: '600',
    color: '#007AFF',
  },
});
