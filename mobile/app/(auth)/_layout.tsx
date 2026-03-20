/**
 * Auth group layout — simple Stack for signup and login screens.
 */

import { Stack } from "expo-router";

export default function AuthLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: "#FFFFFF" },
        animation: "slide_from_right",
      }}
    >
      <Stack.Screen name="signup" />
      <Stack.Screen name="login" />
    </Stack>
  );
}
