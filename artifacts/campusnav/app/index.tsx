import { Feather } from "@expo/vector-icons";
import { router } from "expo-router";
import React from "react";
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

const CAMPUSNAV_LOGO = require("../assets/images/CampusNav.png");

export default function WelcomeScreen() {
  return (
    <SafeAreaView style={styles.screen}>
      <ScrollView contentContainerStyle={styles.screenContent}>
        <View style={styles.card}>
          <View pointerEvents="none" style={styles.topCircle} />
          <View pointerEvents="none" style={styles.bottomCircle} />

          <View style={styles.content}>
            <View style={styles.logoBadge}>
              <Image source={CAMPUSNAV_LOGO} style={styles.logo} resizeMode="contain" />
            </View>
            <Text style={styles.title}>
                Welcome to{" "}
                <Text style={styles.campusText}>Campus</Text>
                <Text style={styles.navText}>Nav</Text>
              </Text>
            <Text style={styles.subtitle}>
              Explore campus with a simpler way to find your destination.
            </Text>
            <Pressable
              accessibilityRole="button"
              onPress={() => router.replace("/(tabs)/map")}
              style={({ pressed }) => [styles.button, pressed && styles.buttonPressed]}
            >
              <Text style={styles.buttonText}>Get Started</Text>
              <Feather name="arrow-right" size={18} color="#fff" />
            </Pressable>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#242730" },
  screenContent: { flexGrow: 1, justifyContent: "center", padding: 20 },
  card: {
    position: "relative",
    width: "100%",
    maxWidth: 430,
    minHeight: 500,
    alignSelf: "center",
    overflow: "hidden",
    backgroundColor: "#fff",
    borderRadius: 26,
    borderWidth: 1,
    borderColor: "#E5E5E5",
  },
  topCircle: {
    position: "absolute",
    top: -105,
    right: -120,
    width: 300,
    height: 300,
    borderRadius: 150,
    backgroundColor: "#DCEBFF",
  },
  bottomCircle: {
    position: "absolute",
    bottom: -180,
    left: -125,
    width: 350,
    height: 350,
    borderRadius: 175,
    backgroundColor: "#7FB5CF",
  },
  content: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 36,
    paddingVertical: 36,
    zIndex: 1,
  },
  logoBadge: {
    width: 88,
    height: 88,
    marginBottom: 22,
    borderRadius: 44,
    backgroundColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.18,
    shadowRadius: 6,
    elevation: 5,
  },
  logo: { width: 58, height: 58 },
  title: {
    color: "#32141F",
    textAlign: "center",
    fontSize: 26,
    fontFamily: "Inter_700Bold",
  },
  campusText: {
  color: "#03294e",
  },
  navText: {
    color: "#FACC15", 
  },
  subtitle: {
    maxWidth: 360,
    marginTop: 10,
    color: "#806E44",
    textAlign: "center",
    fontSize: 15,
    lineHeight: 22,
    fontFamily: "Inter_400Regular",
  },
  button: {
    width: "100%",
    maxWidth: 320,
    minHeight: 52,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    marginTop: 30,
    borderRadius: 12,
    backgroundColor: "#55A9D4",
  },
  buttonPressed: { opacity: 0.82 },
  buttonText: {
    color: "#fff",
    fontSize: 15,
    fontFamily: "Inter_700Bold",
  },
});
