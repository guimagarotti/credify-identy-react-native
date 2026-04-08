import { ScrollView, Text, View, Pressable } from "react-native";
import { useRouter } from "expo-router";

import { ScreenContainer } from "@/components/screen-container";
import { useColors } from "@/hooks/use-colors";

/**
 * Home Screen - Tela Principal do Aplicativo Credify
 *
 * Apresenta a interface inicial com opções para:
 * - Iniciar captura facial
 * - Acessar configurações
 * - Visualizar histórico (futuro)
 */
export default function HomeScreen() {
  const colors = useColors();
  const router = useRouter();

  return (
    <ScreenContainer className="p-6">
      <ScrollView contentContainerStyle={{ flexGrow: 1 }} showsVerticalScrollIndicator={false}>
        <View className="flex-1 gap-8">
          {/* Hero Section */}
          <View className="items-center gap-3 mt-8">
            <Text className="text-4xl font-bold text-foreground">Credify</Text>
            <Text className="text-base text-muted text-center">
              Reconhecimento Facial Seguro
            </Text>
          </View>

          {/* Feature Cards */}
          <View className="gap-4">
            {/* Card 1: Captura Facial */}
            <Pressable
              className="bg-primary rounded-2xl p-6 active:opacity-80"
              style={({ pressed }) => [
                {
                  transform: [{ scale: pressed ? 0.97 : 1 }],
                },
              ]}
              onPress={() => {
                console.log('[HomeScreen] 🔵 Navegando para facial-capture');
                router.push('/facial-capture');
              }}
            >
              <View className="gap-2">
                <Text className="text-2xl">📸</Text>
                <Text className="text-lg font-semibold text-background">
                  Iniciar Captura
                </Text>
                <Text className="text-sm text-background opacity-90">
                  Verifique sua identidade capturando uma foto do seu rosto
                </Text>
              </View>
            </Pressable>

            {/* Card 2: Informações */}
            <View className="bg-surface rounded-2xl p-6 border border-border">
              <View className="gap-2">
                <Text className="text-2xl">ℹ️</Text>
                <Text className="text-lg font-semibold text-foreground">
                  Como Funciona
                </Text>
                <Text className="text-sm text-muted leading-relaxed">
                  O aplicativo utiliza tecnologia avançada de reconhecimento facial para verificar sua identidade de forma segura e rápida.
                </Text>
              </View>
            </View>

            {/* Card 3: Segurança */}
            <View className="bg-surface rounded-2xl p-6 border border-border">
              <View className="gap-2">
                <Text className="text-2xl">🔒</Text>
                <Text className="text-lg font-semibold text-foreground">
                  Segurança
                </Text>
                <Text className="text-sm text-muted leading-relaxed">
                  Seus dados são criptografados e processados com os mais altos padrões de segurança.
                </Text>
              </View>
            </View>
          </View>

          {/* Spacer */}
          <View className="flex-1" />

          {/* Footer Info */}
          <View className="items-center gap-2 pb-4">
            <Text className="text-xs text-muted">Versão 1.0.0</Text>
            <Text className="text-xs text-muted">
              Powered by Credify & Identy
            </Text>
          </View>
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}
