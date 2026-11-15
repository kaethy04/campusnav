import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import React, { useMemo, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Image,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { BuildingListItem } from "@/components/BuildingListItem";
import { ThemeToggle } from "@/components/ThemeToggle";
import {
  BuildingCategory,
  getCategoryColor,
} from "@/constants/buildings";
import { useColors } from "@/hooks/useColors";
import { useBuildings } from "@/hooks/useBuildings";
import { useUserPlaces } from "@/hooks/useUserPlaces";

const CATEGORIES: Array<{ key: BuildingCategory | "all"; label: string }> = [
  { key: "all", label: "All" },
  { key: "academic", label: "Academic" },
  { key: "admin", label: "Admin" },
  { key: "facility", label: "Facility" },
  { key: "sports", label: "Sports" },
];
//const EXPLORE_BACKGROUND = require("../../assets/images/ctucampus.jpg");

export default function SearchScreen() {
  const colors = useColors();
  const places = useUserPlaces();
  const insets = useSafeAreaInsets();
  const {
    buildings,
    loading: buildingsLoading,
    error: buildingsError,
    refetch,
  } = useBuildings();
  const [query, setQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState<
    BuildingCategory | "all"
  >("all");

  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const isSearchingTba = query.trim().toLowerCase() === "tba";

  const filtered = useMemo(() => {
    let list = buildings;
    if (activeCategory !== "all") {
      list = list.filter((b) => b.category === activeCategory);
    }
    if (query.trim()) {
      const q = query.toLowerCase();
      list = list.filter(
        (b) =>
          b.name.toLowerCase().includes(q) ||
          b.shortName.toLowerCase().includes(q) ||
          b.description.toLowerCase().includes(q) ||
          b.rooms.some((r) => r.toLowerCase().includes(q))
      );
    }
    return list;
  }, [buildings, query, activeCategory]);
  const savedBuildings = useMemo(
    () => places.savedPlaces.map((id) => buildings.find((building) => building.id === id)).filter((building) => building !== undefined),
    [buildings, places.savedPlaces],
  );
  const recentBuildings = useMemo(
    () => places.recentSearches.map((id) => buildings.find((building) => building.id === id)).filter((building) => building !== undefined),
    [buildings, places.recentSearches],
  );
  const showPersonalPlaces = !query.trim() && activeCategory === "all";

  return (
  <View style={[styles.container, { backgroundColor: colors.background }]}>
     {/*Image
        source={EXPLORE_BACKGROUND}
        style={styles.backgroundImage}
        resizeMode="cover"
      />
      <View
        style={[styles.backgroundWash, { backgroundColor: colors.background + "D9" }]}
        pointerEvents="none"
      /> */}

      {/* Top bar */}
      <View
        style={[
          styles.topBar,
          { paddingTop: topPad + 16 },
        ]}
      >
        <View style={styles.titleRow}>
          <Text style={[styles.title, { color: colors.foreground }]}>
            Explore Campus
          </Text>
          <View style={styles.titleActions}>
            <Text style={[styles.count, { color: colors.mutedForeground }]}> 
              {buildings.length} locations
            </Text>
            <ThemeToggle />
          </View>
        </View>
        {places.error && (
          <Text style={[styles.placesError, { color: colors.destructive }]} accessibilityRole="alert">
            {places.error}
          </Text>
        )}

        {/* Search bar */}
        <View
          style={[
            styles.searchBar,
            { backgroundColor: colors.card, borderColor: colors.border },
          ]}
        >
          <Feather name="search" size={16} color={colors.mutedForeground} />
          <TextInput
            style={[styles.searchInput, { color: colors.foreground }]}
            placeholder="Search buildings, rooms..."
            placeholderTextColor={colors.mutedForeground}
            value={query}
            onChangeText={setQuery}
            returnKeyType="search"
            clearButtonMode="while-editing"
          />
          {query.length > 0 && (
            <Pressable
              onPress={() => setQuery("")}
              hitSlop={8}
            >
              <Feather name="x-circle" size={15} color={colors.mutedForeground} />
            </Pressable>
          )}
        </View>
        {/* Category chips */}
        <FlatList
          horizontal
          style={styles.chipScroll}
          data={CATEGORIES}
          keyExtractor={(item) => item.key}
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.chipList}
          renderItem={({ item }) => {
            const isActive = activeCategory === item.key;
            const catColor =
              item.key === "all"
                ? colors.primary
                : getCategoryColor(item.key);
            return (
              <Pressable
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  setActiveCategory(item.key);
                }}
                style={[
                  styles.chip,
                  {
                    backgroundColor: isActive
                      ? catColor
                      : colors.card,
                    borderColor: isActive ? catColor : colors.border,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.chipText,
                    { color: isActive ? "#fff" : colors.foreground },
                  ]}
                >
                  {item.label}
                </Text>
              </Pressable>
            );
          }}
        />
        {isSearchingTba && (
          <Text style={[styles.searchHint, { color: colors.mutedForeground }]}>
            TBA means “To Be Announced.”
          </Text>
        )}
      </View>

      {/* Results */}
      <FlatList
        data={filtered}
        keyExtractor={(item) => item.id}
        contentContainerStyle={[
          styles.listContent,
          {
            paddingBottom:
              Platform.OS === "web" ? 34 + 84 : insets.bottom + 84,
          },
        ]}
        ListHeaderComponent={showPersonalPlaces ? (
          <View>
            <View style={styles.personalSection}>
              <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Saved places</Text>
              {savedBuildings.length > 0 ? (
                savedBuildings.map((building) => (
                  <BuildingListItem
                    key={`saved-${building.id}`}
                    building={building}
                    isSaved
                    onToggleSaved={() => void places.toggleSavedPlace(building.id)}
                  />
                ))
              ) : (
                <Text style={[styles.personalEmpty, { color: colors.mutedForeground }]}>
                  Star a building to keep it handy here.
                </Text>
              )}
            </View>
            <View style={styles.personalSection}>
              <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Recent searches</Text>
              {recentBuildings.length > 0 ? (
                recentBuildings.map((building) => (
                  <BuildingListItem
                    key={`recent-${building.id}`}
                    building={building}
                    isSaved={places.savedPlaces.includes(building.id)}
                    onToggleSaved={() => void places.toggleSavedPlace(building.id)}
                  />
                ))
              ) : (
                <Text style={[styles.personalEmpty, { color: colors.mutedForeground }]}>
                  Places you open or navigate to will appear here.
                </Text>
              )}
            </View>
            {places.loading && savedBuildings.length === 0 && recentBuildings.length === 0 && (
              <ActivityIndicator size="small" color={colors.primary} style={styles.placesLoading} />
            )}
          </View>
        ) : undefined}
        renderItem={({ item }) => (
          <BuildingListItem
            building={item}
            isSaved={places.savedPlaces.includes(item.id)}
            onToggleSaved={() => void places.toggleSavedPlace(item.id)}
          />
        )}
        scrollEnabled={!!filtered.length}
        ListEmptyComponent={() =>
          buildingsLoading ? (
            <View style={styles.empty}>
              <ActivityIndicator size="large" color={colors.primary} />
              <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
                Loading buildings…
              </Text>
            </View>
          ) : buildingsError && buildings.length === 0 ? (
            <View style={styles.empty}>
              <Feather name="alert-circle" size={40} color={colors.destructive} />
              <Text style={[styles.emptyTitle, { color: colors.foreground }]}>
                Could not load locations
              </Text>
              <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
                {buildingsError}
              </Text>
              <Pressable
                accessibilityRole="button"
                onPress={() => void refetch()}
                style={[styles.retryButton, { backgroundColor: colors.primary }]}
              >
                <Text style={styles.retryButtonText}>Try again</Text>
              </Pressable>
            </View>
          ) : (
            <View style={styles.empty}>
              <Feather name="search" size={40} color={colors.mutedForeground} />
              <Text style={[styles.emptyTitle, { color: colors.foreground }]}>
                No results
              </Text>
              <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
                Try a different search term or category
              </Text>
            </View>
          )
        }
        showsVerticalScrollIndicator={false}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  backgroundImage: {
    ...StyleSheet.absoluteFill,
    opacity: 1,
  },
  backgroundWash: {
    ...StyleSheet.absoluteFill,
  },
  topBar: {
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  titleRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "baseline",
    marginBottom: 12,
  },
  titleActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  logoutButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
  },
  title: {
    fontSize: 24,
    fontFamily: "Inter_700Bold",
  },
  count: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
  },
  placesError: {
    fontSize: 12,
    fontFamily: "Inter_500Medium",
    marginBottom: 8,
  },
  personalSection: {
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 16,
    fontFamily: "Inter_600SemiBold",
    marginBottom: 8,
    marginTop: 4,
  },
  personalEmpty: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    marginBottom: 8,
  },
  placesLoading: {
    marginVertical: 12,
  },
  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 16,
    height: 46,
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: 12,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    fontFamily: "Inter_400Regular",
  },
  searchHint: {
    fontSize: 13,
    fontFamily: "Inter_500Medium",
    marginTop: -4,
    marginBottom: 8,
  },
  chipList: {
    paddingBottom: 8,
    paddingHorizontal: 16,
    gap: 8,
  },
  chipScroll: {
    marginHorizontal: -16,
  },
  chip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
  },
  chipText: {
    fontSize: 13,
    fontFamily: "Inter_500Medium",
  },
  listContent: {
    paddingHorizontal: 16,
    paddingTop: 4,
  },
  empty: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 60,
    gap: 8,
  },
  emptyTitle: {
    fontSize: 18,
    fontFamily: "Inter_600SemiBold",
    marginTop: 8,
  },
  emptyText: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    textAlign: "center",
  },
  retryButton: {
    marginTop: 16,
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 10,
  },
  retryButtonText: {
    color: "#fff",
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
  },
});
