import { Feather } from "@expo/vector-icons";
import { router } from "expo-router";
import React from "react";
import { Image, Pressable, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { useColors } from "@/hooks/useColors";

const CAMPUSNAV_LOGO = require("../assets/images/campusnavlg.png");

export default function WelcomeScreen() {
  const colors = useColors();
  const { width } = useWindowDimensions();
  const isWide = width >= 760;

  return (
    <SafeAreaView style={[styles.screen, { backgroundColor: colors.background }]}>
      <View
        style={[
          styles.card,
          isWide && styles.wideCard,
          { backgroundColor: colors.card, borderColor: colors.border },
        ]}
      >
        <View style={[styles.brandPanel, { backgroundColor: colors.primary }]}>
          <View style={styles.logoFrame}>
            <Image source={CAMPUSNAV_LOGO} style={styles.logo} resizeMode="contain" />
          </View>
          <Text style={styles.brandName}>CampusNav</Text>
          {isWide && <Text style={styles.brandCaption}>Find your way around campus</Text>}
        </View>

        <View style={styles.content}>
          {!isWide && (
            <Image source={CAMPUSNAV_LOGO} style={styles.mobileLogo} resizeMode="contain" />
          )}
          <Text style={[styles.title, { color: colors.foreground }]}>
            Welcome to CampusNav
          </Text>
          <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
            Explore campus with a simpler way to find your destination.
          </Text>
          <Pressable
            accessibilityRole="button"
            onPress={() => router.replace("/(tabs)/map")}
            style={({ pressed }) => [
              styles.button,
              { backgroundColor: colors.primary, opacity: pressed ? 0.82 : 1 },
            ]}
          >
            <Text style={[styles.buttonText, { color: colors.primaryForeground }]}>Get Started</Text>
            <Feather name="arrow-right" size={18} color={colors.primaryForeground} />
          </Pressable>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, justifyContent: "center", padding: 20 },
  card: {
    width: "100%",
    maxWidth: 480,
    alignSelf: "center",
    overflow: "hidden",
    borderWidth: 1,
    borderRadius: 24,
  },
  wideCard: { maxWidth: 1000, minHeight: 520, flexDirection: "row" },
  brandPanel: {
    minHeight: 180,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  logoFrame: {
    width: 112,
    height: 112,
    alignItems: "center",
    justifyContent: "center",
  },
  logo: { width: "100%", height: "100%" },
  brandName: { marginTop: 8, color: "#fff", fontSize: 22, fontFamily: "Inter_700Bold" },
  brandCaption: { marginTop: 8, color: "#fff", fontSize: 15, fontFamily: "Inter_400Regular" },
  content: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 28,
    paddingVertical: 36,
  },
  mobileLogo: { width: 156, height: 64, marginBottom: 22 },
  title: { textAlign: "center", fontSize: 26, fontFamily: "Inter_700Bold" },
  subtitle: {
    maxWidth: 360,
    marginTop: 10,
    textAlign: "center",
    fontSize: 15,
    lineHeight: 22,
    fontFamily: "Inter_400Regular",
  },
  button: {
    width: "100%",
    maxWidth: 320,
    minHeight: 50,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    marginTop: 28,
    borderRadius: 13,
  },
  buttonText: { fontSize: 15, fontFamily: "Inter_700Bold" },
});
