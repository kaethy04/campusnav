import { Tabs } from "expo-router";
//port { LinearGradient } from "expo-linear-gradient";
import { SymbolView } from "expo-symbols";
import { Feather } from "@expo/vector-icons";
import React from "react";
import { Platform, StyleSheet } from "react-native";

function ClassicTabLayout() {
  const isIOS = Platform.OS === "ios";
  const isWeb = Platform.OS === "web";

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: "#01274d",
        tabBarInactiveTintColor: "#fefdfa",
        headerShown: false,
        tabBarStyle: {
          position: "absolute",
          backgroundColor: "#1976D2",
          borderTopWidth: isWeb ? 1 : 0,
          borderTopColor: "#83C5F5",
          elevation: 0,
          ...(isWeb ? { height: 84 } : {}),
        },
        
      }}
    >
      <Tabs.Screen
        name="map"
        options={{
          title: "Map",
          tabBarIcon: ({ focused }) =>
            isIOS ? (
              <SymbolView name="map" tintColor={focused ? "#01274d" : "#fefdfa"} size={24} />
            ) : (
              <Feather name="map" size={22} color={focused ? "#01274d" : "#fefdfa"} />
            ),
        }}
      />
      <Tabs.Screen
        name="search"
        options={{
          title: "Explore",
          tabBarIcon: ({ focused }) =>
            isIOS ? (
              <SymbolView name="magnifyingglass" tintColor={focused ? "#01274d" : "#fefdfa"} size={24} />
            ) : (
              <Feather name="search" size={22} color={focused ? "#01274d" : "#fefdfa"} />
            ),
        }}
      />
    </Tabs>
  );
}

export default function TabLayout() {
  return <ClassicTabLayout />;
}
