import { Feather } from "@expo/vector-icons";
import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { useColors } from "@/hooks/useColors";
import { useTheme } from "@/hooks/useTheme";

type ThemeToggleProps = {
  variant?: "icon" | "menu";
};

export function ThemeToggle({ variant = "icon" }: ThemeToggleProps) {
  const colors = useColors();
  const { mode, toggleMode } = useTheme();
  const isMenuItem = variant === "menu";

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={
        isMenuItem
          ? `Appearance, switch to ${mode === "dark" ? "light" : "dark"} mode`
          : `Switch to ${mode === "dark" ? "light" : "dark"} mode`
      }
      onPress={toggleMode}
      style={({ pressed }) =>
        isMenuItem
          ? [styles.menuButton, pressed && styles.menuButtonPressed]
          : [
              styles.button,
              { backgroundColor: pressed ? colors.secondary : colors.primaryLight },
            ]
      }
    >
      {isMenuItem ? (
        <>
          <View style={[styles.menuIconButton, { backgroundColor: colors.primaryLight }]}>
            <Feather name={mode === "dark" ? "sun" : "moon"} size={16} color={colors.primary} />
          </View>
          <Text style={[styles.menuLabel, { color: colors.foreground }]}>Appearance</Text>
        </>
      ) : (
        <Feather name={mode === "dark" ? "sun" : "moon"} size={16} color={colors.primary} />
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
  },
  menuButton: {
    minHeight: 40,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 2,
  },
  menuButtonPressed: {
    opacity: 0.65,
  },
  menuIconButton: {
    width: 32,
    height: 32,
    borderRadius: 9,
    alignItems: "center",
    justifyContent: "center",
  },
  menuLabel: {
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
  },
});