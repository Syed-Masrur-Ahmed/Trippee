// Geospatial utility functions for Trippee

interface Location {
  lat: number;
  lng: number;
}

interface Place extends Location {
  id: string;
  name: string;
}

/**
 * Calculate distance between two coordinates using Haversine formula
 * @returns Distance in kilometers
 */
export function getDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371; // Earth radius in kilometers
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
  
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const distance = R * c;
  
  return distance;
}

/**
 * Convert degrees to radians
 */
function toRad(degrees: number): number {
  return degrees * (Math.PI / 180);
}

/**
 * Calculate the geographic center (centroid) of a group of places
 */
export function getCentroid(places: Location[]): Location {
  if (places.length === 0) {
    return { lat: 0, lng: 0 };
  }

  let sumLat = 0;
  let sumLng = 0;

  for (const place of places) {
    sumLat += place.lat;
    sumLng += place.lng;
  }

  return {
    lat: sumLat / places.length,
    lng: sumLng / places.length,
  };
}

/**
 * Improved k-means clustering algorithm with better initialization
 * @param places - Array of places to cluster
 * @param k - Number of clusters (typically number of days)
 * @returns Array of clusters, each containing places
 */
export function clusterPlaces(places: Place[], k: number): Place[][] {
  if (places.length === 0 || k <= 0) {
    return [];
  }

  // If we have fewer places than clusters, return each place in its own cluster
  if (places.length <= k) {
    return places.map((p) => [p]);
  }

  // Better initialization: use k-means++ algorithm
  // Start with a random place as first centroid
  const centroids: Location[] = [];
  const usedIndices = new Set<number>();
  
  // First centroid: random place
  const firstIndex = Math.floor(Math.random() * places.length);
  centroids.push({
    lat: places[firstIndex].lat,
    lng: places[firstIndex].lng,
  });
  usedIndices.add(firstIndex);

  // Subsequent centroids: choose places farthest from existing centroids
  while (centroids.length < k) {
    let maxMinDistance = -1;
    let bestIndex = -1;

    for (let i = 0; i < places.length; i++) {
      if (usedIndices.has(i)) continue;

      // Find minimum distance to any existing centroid
      let minDistance = Infinity;
      for (const centroid of centroids) {
        const distance = getDistance(
          places[i].lat,
          places[i].lng,
          centroid.lat,
          centroid.lng
        );
        minDistance = Math.min(minDistance, distance);
      }

      // Choose the place with maximum minimum distance (farthest from all centroids)
      if (minDistance > maxMinDistance) {
        maxMinDistance = minDistance;
        bestIndex = i;
      }
    }

    if (bestIndex >= 0) {
      centroids.push({
        lat: places[bestIndex].lat,
        lng: places[bestIndex].lng,
      });
      usedIndices.add(bestIndex);
    } else {
      // Fallback: just pick any unused place
      for (let i = 0; i < places.length; i++) {
        if (!usedIndices.has(i)) {
          centroids.push({
            lat: places[i].lat,
            lng: places[i].lng,
          });
          usedIndices.add(i);
          break;
        }
      }
    }
  }

  let clusters: Place[][] = [];
  let iterations = 0;
  const maxIterations = 20;

  // Run k-means iterations
  while (iterations < maxIterations) {
    // Assign each place to nearest centroid
    clusters = Array.from({ length: k }, () => []);

    for (const place of places) {
      let minDistance = Infinity;
      let closestCluster = 0;

      for (let i = 0; i < centroids.length; i++) {
        const distance = getDistance(place.lat, place.lng, centroids[i].lat, centroids[i].lng);
        if (distance < minDistance) {
          minDistance = distance;
          closestCluster = i;
        }
      }

      clusters[closestCluster].push(place);
    }

    // Handle empty clusters: reassign centroid to farthest unassigned place
    for (let i = 0; i < k; i++) {
      if (clusters[i].length === 0) {
        // Find the largest cluster
        let largestClusterSize = 0;
        let largestClusterIndex = 0;
        for (let j = 0; j < k; j++) {
          if (clusters[j].length > largestClusterSize) {
            largestClusterSize = clusters[j].length;
            largestClusterIndex = j;
          }
        }

        // Split the largest cluster: move farthest place to empty cluster
        if (largestClusterSize > 1) {
          const largestCluster = clusters[largestClusterIndex];
          const clusterCentroid = getCentroid(largestCluster);
          
          let maxDistance = -1;
          let farthestIndex = -1;
          for (let j = 0; j < largestCluster.length; j++) {
            const distance = getDistance(
              largestCluster[j].lat,
              largestCluster[j].lng,
              clusterCentroid.lat,
              clusterCentroid.lng
            );
            if (distance > maxDistance) {
              maxDistance = distance;
              farthestIndex = j;
            }
          }

          if (farthestIndex >= 0) {
            const farthestPlace = largestCluster.splice(farthestIndex, 1)[0];
            clusters[i].push(farthestPlace);
            centroids[i] = { lat: farthestPlace.lat, lng: farthestPlace.lng };
          }
        }
      }
    }

    // Update centroids to be the center of their clusters
    let centroidsChanged = false;
    for (let i = 0; i < k; i++) {
      if (clusters[i].length > 0) {
        const newCentroid = getCentroid(clusters[i]);
        const oldCentroid = centroids[i];
        
        // Check if centroid moved significantly (1km threshold)
        const movement = getDistance(
          oldCentroid.lat,
          oldCentroid.lng,
          newCentroid.lat,
          newCentroid.lng
        );
        
        if (movement > 1.0) {
          // 1 kilometer
          centroidsChanged = true;
        }
        
        centroids[i] = newCentroid;
      }
    }

    // If centroids didn't change much, we've converged
    if (!centroidsChanged) {
      break;
    }

    iterations++;
  }

  // Ensure we have exactly k clusters (pad with empty arrays if needed, but filter them out)
  // Sort clusters by size (largest first) to ensure balanced distribution
  const sortedClusters = clusters
    .filter((c) => c.length > 0)
    .sort((a, b) => b.length - a.length);

  // If we have fewer than k clusters, something went wrong - return what we have
  return sortedClusters;
}

/**
 * Calculate total distance for a route (sum of distances between consecutive places)
 */
export function calculateRouteDistance(places: Place[]): number {
  if (places.length < 2) {
    return 0;
  }

  let totalDistance = 0;
  for (let i = 0; i < places.length - 1; i++) {
    totalDistance += getDistance(
      places[i].lat,
      places[i].lng,
      places[i + 1].lat,
      places[i + 1].lng
    );
  }

  return totalDistance;
}

/**
 * Simple greedy nearest-neighbor algorithm to optimize route order
 * (Simplified Traveling Salesman Problem solution)
 * @returns Places reordered for minimal travel distance
 */
export function optimizeRoute(places: Place[]): Place[] {
  if (places.length <= 2) {
    return places;
  }

  const unvisited = [...places];
  const route: Place[] = [];

  // Start with the first place
  route.push(unvisited[0]);
  unvisited.splice(0, 1);

  // Repeatedly pick the nearest unvisited place
  while (unvisited.length > 0) {
    const current = route[route.length - 1];
    let nearestIndex = 0;
    let nearestDistance = Infinity;

    for (let i = 0; i < unvisited.length; i++) {
      const distance = getDistance(
        current.lat,
        current.lng,
        unvisited[i].lat,
        unvisited[i].lng
      );

      if (distance < nearestDistance) {
        nearestDistance = distance;
        nearestIndex = i;
      }
    }

    route.push(unvisited[nearestIndex]);
    unvisited.splice(nearestIndex, 1);
  }

  return route;
}

/**
 * Estimate travel time in minutes based on distance
 * Assumes average speed of 30 km/h (accounting for traffic, walking, etc.)
 */
export function estimateTravelTime(distanceKm: number): number {
  const averageSpeedKmh = 30;
  return Math.round((distanceKm / averageSpeedKmh) * 60);
}

/**
 * Check if two places are within a certain radius (in km)
 */
export function isWithinRadius(place1: Location, place2: Location, radiusKm: number): boolean {
  const distance = getDistance(place1.lat, place1.lng, place2.lat, place2.lng);
  return distance <= radiusKm;
}

/**
 * Find all places within a radius of a center point
 */
export function getPlacesWithinRadius(
  center: Location,
  places: Place[],
  radiusKm: number
): Place[] {
  return places.filter((place) => isWithinRadius(center, place, radiusKm));
}

