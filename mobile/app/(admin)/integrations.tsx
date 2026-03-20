/**
 * Admin Integrations — Frappe CRM, GitHub Issues, Calendly config.
 */

import { useEffect, useState, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Switch,
} from "react-native";
import api from "@/lib/api";

interface IntConfig {
  frappe_url: string | null;
  frappe_token_set: boolean;
  github_repo: string | null;
  github_pat_set: boolean;
  calendly_link: string | null;
}

export default function AdminIntegrations() {
  const [config, setConfig] = useState<IntConfig | null>(null);
  const [loading, setLoading] = useState(true);

  // Toggle states
  const [frappeOpen, setFrappeOpen] = useState(false);
  const [githubOpen, setGithubOpen] = useState(false);
  const [calendlyOpen, setCalendlyOpen] = useState(false);

  // Form values
  const [frappeUrl, setFrappeUrl] = useState("");
  const [frappeToken, setFrappeToken] = useState("");
  const [githubRepo, setGithubRepo] = useState("");
  const [githubPat, setGithubPat] = useState("");
  const [calendlyLink, setCalendlyLink] = useState("");

  const [saving, setSaving] = useState<string | null>(null);

  const fetchConfig = useCallback(async () => {
    try {
      const res = await api.get("/integrations/");
      const c: IntConfig = res.data;
      setConfig(c);
      setFrappeUrl(c.frappe_url || "");
      setGithubRepo(c.github_repo || "");
      setCalendlyLink(c.calendly_link || "");
      setFrappeOpen(!!c.frappe_url);
      setGithubOpen(!!c.github_repo);
      setCalendlyOpen(!!c.calendly_link);
    } catch {} finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchConfig(); }, [fetchConfig]);

  const save = async (section: string, data: Record<string, string | null>) => {
    setSaving(section);
    try {
      await api.put("/integrations/", data);
      Alert.alert("Saved", `${section} configuration updated.`);
      fetchConfig();
    } catch (err: any) {
      Alert.alert("Error", err.response?.data?.detail || "Failed to save.");
    } finally {
      setSaving(null);
    }
  };

  if (loading) {
    return <View style={styles.centered}><ActivityIndicator size="large" color="#FFFFFF" /></View>;
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 40 }}>
      {/* Frappe CRM */}
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <View>
            <Text style={styles.cardTitle}>Frappe CRM</Text>
            <Text style={styles.cardDesc}>Auto-file leads into your CRM</Text>
          </View>
          <Switch
            value={frappeOpen}
            onValueChange={setFrappeOpen}
            trackColor={{ false: "#333333", true: "#FFFFFF" }}
            thumbColor={frappeOpen ? "#000000" : "#FFFFFF"}
          />
        </View>
        {frappeOpen && (
          <View style={styles.cardBody}>
            <Text style={styles.fieldLabel}>API URL</Text>
            <TextInput
              style={styles.input}
              value={frappeUrl}
              onChangeText={setFrappeUrl}
              placeholder="https://your-site.frappe.cloud"
              placeholderTextColor="#666666"
              autoCapitalize="none"
            />
            <Text style={styles.fieldLabel}>API Token {config?.frappe_token_set ? "(set ••••••••)" : ""}</Text>
            <TextInput
              style={styles.input}
              value={frappeToken}
              onChangeText={setFrappeToken}
              placeholder={config?.frappe_token_set ? "Leave blank to keep current" : "api_key:api_secret"}
              placeholderTextColor="#666666"
              autoCapitalize="none"
              secureTextEntry
            />
            <TouchableOpacity
              style={[styles.saveBtn, saving === "Frappe" && styles.saveBtnDisabled]}
              onPress={() => save("Frappe", { frappe_url: frappeUrl, frappe_token: frappeToken || null })}
              disabled={saving === "Frappe"}
            >
              {saving === "Frappe" ? <ActivityIndicator color="#FFFFFF" size="small" /> : <Text style={styles.saveBtnText}>Save</Text>}
            </TouchableOpacity>
          </View>
        )}
      </View>

      {/* GitHub Issues */}
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <View>
            <Text style={styles.cardTitle}>GitHub Issues</Text>
            <Text style={styles.cardDesc}>Create issues for hot leads</Text>
          </View>
          <Switch
            value={githubOpen}
            onValueChange={setGithubOpen}
            trackColor={{ false: "#333333", true: "#FFFFFF" }}
            thumbColor={githubOpen ? "#000000" : "#FFFFFF"}
          />
        </View>
        {githubOpen && (
          <View style={styles.cardBody}>
            <Text style={styles.fieldLabel}>Repository (owner/repo)</Text>
            <TextInput
              style={styles.input}
              value={githubRepo}
              onChangeText={setGithubRepo}
              placeholder="acme/sales-leads"
              placeholderTextColor="#666666"
              autoCapitalize="none"
            />
            <Text style={styles.fieldLabel}>Personal Access Token {config?.github_pat_set ? "(set ••••••••)" : ""}</Text>
            <TextInput
              style={styles.input}
              value={githubPat}
              onChangeText={setGithubPat}
              placeholder={config?.github_pat_set ? "Leave blank to keep current" : "ghp_xxxxxxxxxxxx"}
              placeholderTextColor="#666666"
              autoCapitalize="none"
              secureTextEntry
            />
            <TouchableOpacity
              style={[styles.saveBtn, saving === "GitHub" && styles.saveBtnDisabled]}
              onPress={() => save("GitHub", { github_repo: githubRepo, github_pat: githubPat || null })}
              disabled={saving === "GitHub"}
            >
              {saving === "GitHub" ? <ActivityIndicator color="#FFFFFF" size="small" /> : <Text style={styles.saveBtnText}>Save</Text>}
            </TouchableOpacity>
          </View>
        )}
      </View>

      {/* Calendly */}
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <View>
            <Text style={styles.cardTitle}>Calendly</Text>
            <Text style={styles.cardDesc}>Show booking link at decision-ready</Text>
          </View>
          <Switch
            value={calendlyOpen}
            onValueChange={setCalendlyOpen}
            trackColor={{ false: "#333333", true: "#FFFFFF" }}
            thumbColor={calendlyOpen ? "#000000" : "#FFFFFF"}
          />
        </View>
        {calendlyOpen && (
          <View style={styles.cardBody}>
            <Text style={styles.fieldLabel}>Calendly URL</Text>
            <TextInput
              style={styles.input}
              value={calendlyLink}
              onChangeText={setCalendlyLink}
              placeholder="https://calendly.com/your-name/30min"
              placeholderTextColor="#666666"
              autoCapitalize="none"
            />
            <TouchableOpacity
              style={[styles.saveBtn, saving === "Calendly" && styles.saveBtnDisabled]}
              onPress={() => save("Calendly", { calendly_link: calendlyLink })}
              disabled={saving === "Calendly"}
            >
              {saving === "Calendly" ? <ActivityIndicator color="#FFFFFF" size="small" /> : <Text style={styles.saveBtnText}>Save</Text>}
            </TouchableOpacity>
          </View>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#000000", padding: 16 },
  centered: { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "#000000" },
  card: {
    backgroundColor: "#111111",
    borderRadius: 24,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "#222222",
    overflow: "hidden",
  },
  cardHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", padding: 20 },
  cardTitle: { fontSize: 18, fontWeight: "800", color: "#FFFFFF", letterSpacing: -0.5 },
  cardDesc: { fontSize: 14, color: "#999999", marginTop: 4, fontWeight: "500" },
  cardBody: { padding: 20, paddingTop: 0, borderTopWidth: 1, borderTopColor: "#222222", marginTop: 12 },
  fieldLabel: { fontSize: 10, fontWeight: "800", color: "#666666", marginTop: 24, marginBottom: 12, textTransform: "uppercase", letterSpacing: 2 },
  input: {
    borderWidth: 1,
    borderColor: "#333333",
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: "#FFFFFF",
    backgroundColor: "#1A1A1A",
    fontWeight: "600",
  },
  saveBtn: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: "center",
    marginTop: 24,
  },
  saveBtnDisabled: { opacity: 0.7 },
  saveBtnText: { color: "#000000", fontSize: 16, fontWeight: "800" },
});
