/**
 * Admin KB — upload documents, view list, delete.
 */

import { useEffect, useState, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  RefreshControl,
} from "react-native";
import * as DocumentPicker from "expo-document-picker";
import { FileText, RefreshCcw } from "lucide-react-native";
import api from "@/lib/api";

interface KBDoc {
  id: string;
  filename: string;
  file_type: string;
  chunk_count: number;
  uploaded_at: string | null;
}

export default function AdminKB() {
  const [docs, setDocs] = useState<KBDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const fetchDocs = useCallback(async () => {
    try {
      const res = await api.get("/kb/documents");
      setDocs(res.data);
    } catch {} finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { fetchDocs(); }, [fetchDocs]);

  const onRefresh = useCallback(() => { setRefreshing(true); fetchDocs(); }, [fetchDocs]);

  const handleUpload = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ["application/pdf", "text/csv"],
        copyToCacheDirectory: true,
      });

      if (result.canceled || !result.assets?.[0]) return;

      const file = result.assets[0];
      if (file.size && file.size > 10 * 1024 * 1024) {
        Alert.alert("File too large", "Maximum file size is 10MB.");
        return;
      }

      setUploading(true);
      const formData = new FormData();
      formData.append("file", {
        uri: file.uri,
        name: file.name,
        type: file.mimeType || "application/octet-stream",
      } as any);

      await api.post("/kb/upload", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      Alert.alert("Success", "Document uploaded and processed.");
      fetchDocs();
    } catch (err: any) {
      Alert.alert("Upload failed", err.response?.data?.detail || err.message || "Something went wrong.");
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = (docId: string, filename: string) => {
    Alert.alert("Delete document", `Remove "${filename}" and all its chunks?`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          try {
            await api.delete(`/kb/documents/${docId}`);
            setDocs((prev) => prev.filter((d) => d.id !== docId));
          } catch {
            Alert.alert("Error", "Failed to delete document.");
          }
        },
      },
    ]);
  };

  if (loading) {
    return <View style={styles.centered}><ActivityIndicator size="large" color="#FFFFFF" /></View>;
  }

  return (
    <View style={styles.container}>
      <TouchableOpacity
        style={[styles.uploadBtn, uploading && styles.uploadBtnDisabled]}
        onPress={handleUpload}
        disabled={uploading}
        activeOpacity={0.85}
      >
        {uploading ? (
          <ActivityIndicator color="#000000" />
        ) : (
          <Text style={styles.uploadBtnText}>Upload document (PDF or CSV)</Text>
        )}
      </TouchableOpacity>

      {docs.length === 0 ? (
        <View style={styles.emptyState}>
          <FileText size={48} color="#666666" style={{ marginBottom: 16 }} />
          <Text style={styles.emptyText}>Upload your first document to power your AI agent</Text>
        </View>
      ) : (
        <FlatList
          data={docs}
          keyExtractor={(item) => item.id}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#FFFFFF" />}
          renderItem={({ item }) => (
            <View style={styles.docCard}>
              <View style={styles.docInfo}>
                <Text style={styles.docName}>{item.filename}</Text>
                <View style={styles.docMeta}>
                  <View style={styles.typeBadge}>
                    <Text style={styles.typeBadgeText}>
                      {item.file_type.toUpperCase()}
                    </Text>
                  </View>
                  <Text style={styles.chunkText}>{item.chunk_count} chunks</Text>
                </View>
              </View>
              <TouchableOpacity
                onPress={() => handleDelete(item.id, item.filename)}
                style={styles.deleteBtn}
              >
                <Text style={styles.deleteBtnText}>✕</Text>
              </TouchableOpacity>
            </View>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#000000", padding: 16 },
  centered: { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "#000000" },
  uploadBtn: {
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    paddingVertical: 18,
    alignItems: "center",
    marginBottom: 20,
    shadowColor: "#FFFFFF",
    shadowOpacity: 0.2,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
  },
  uploadBtnDisabled: { opacity: 0.7 },
  uploadBtnText: { color: "#000000", fontSize: 16, fontWeight: "800", letterSpacing: -0.5 },
  emptyState: { flex: 1, justifyContent: "center", alignItems: "center" },
  emptyIcon: { fontSize: 48, marginBottom: 16 },
  emptyText: { fontSize: 15, color: "#999999", textAlign: "center", paddingHorizontal: 40 },
  docCard: {
    backgroundColor: "#111111",
    borderRadius: 24,
    padding: 20,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#222222",
    flexDirection: "row",
    alignItems: "center",
  },
  docInfo: { flex: 1 },
  docName: { fontSize: 17, fontWeight: "700", color: "#FFFFFF", marginBottom: 8, letterSpacing: -0.5 },
  docMeta: { flexDirection: "row", alignItems: "center", gap: 10 },
  typeBadge: { borderRadius: 12, paddingHorizontal: 10, paddingVertical: 4, backgroundColor: "#1A1A1A", borderWidth: 1, borderColor: "#333333" },
  typeBadgeText: { fontSize: 10, fontWeight: "800", color: "#FFFFFF", textTransform: "uppercase", letterSpacing: 1 },
  chunkText: { fontSize: 12, color: "#999999", fontWeight: "600" },
  deleteBtn: { padding: 12, backgroundColor: "#1A1A1A", borderRadius: 16 },
  deleteBtnText: { fontSize: 16, color: "#FF4444", fontWeight: "800" },
});
