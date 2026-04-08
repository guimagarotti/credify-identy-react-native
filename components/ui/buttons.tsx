import { Pressable, Text, View, type PressableProps } from "react-native";
import { useColors } from "@/hooks/use-colors";
import { cn } from "@/lib/utils";

/**
 * Primary Button - Botão principal para ações principais
 *
 * Uso:
 * ```tsx
 * <PrimaryButton onPress={handlePress}>
 *   Iniciar Captura
 * </PrimaryButton>
 * ```
 */
export function PrimaryButton({
  children,
  className,
  disabled,
  ...props
}: PressableProps & { children: React.ReactNode; disabled?: boolean }) {
  const colors = useColors();

  return (
    <Pressable
      disabled={disabled}
      className={cn(
        "bg-primary rounded-lg py-3 items-center active:opacity-80",
        disabled && "opacity-50",
        className
      )}
      style={({ pressed }) => [
        {
          transform: [{ scale: pressed && !disabled ? 0.97 : 1 }],
        },
      ]}
      {...props}
    >
      <Text className="text-base font-semibold text-background">
        {children}
      </Text>
    </Pressable>
  );
}

/**
 * Secondary Button - Botão secundário para ações alternativas
 *
 * Uso:
 * ```tsx
 * <SecondaryButton onPress={handleCancel}>
 *   Cancelar
 * </SecondaryButton>
 * ```
 */
export function SecondaryButton({
  children,
  className,
  disabled,
  ...props
}: PressableProps & { children: React.ReactNode; disabled?: boolean }) {
  return (
    <Pressable
      disabled={disabled}
      className={cn(
        "border border-border rounded-lg py-3 items-center active:opacity-80",
        disabled && "opacity-50",
        className
      )}
      style={({ pressed }) => [
        {
          transform: [{ scale: pressed && !disabled ? 0.97 : 1 }],
        },
      ]}
      {...props}
    >
      <Text className="text-base font-semibold text-foreground">
        {children}
      </Text>
    </Pressable>
  );
}

/**
 * Danger Button - Botão para ações destrutivas
 *
 * Uso:
 * ```tsx
 * <DangerButton onPress={handleDelete}>
 *   Deletar
 * </DangerButton>
 * ```
 */
export function DangerButton({
  children,
  className,
  disabled,
  ...props
}: PressableProps & { children: React.ReactNode; disabled?: boolean }) {
  return (
    <Pressable
      disabled={disabled}
      className={cn(
        "bg-error rounded-lg py-3 items-center active:opacity-80",
        disabled && "opacity-50",
        className
      )}
      style={({ pressed }) => [
        {
          transform: [{ scale: pressed && !disabled ? 0.97 : 1 }],
        },
      ]}
      {...props}
    >
      <Text className="text-base font-semibold text-background">
        {children}
      </Text>
    </Pressable>
  );
}

/**
 * Button Group - Agrupa múltiplos botões
 *
 * Uso:
 * ```tsx
 * <ButtonGroup>
 *   <PrimaryButton onPress={handleSubmit}>Enviar</PrimaryButton>
 *   <SecondaryButton onPress={handleCancel}>Cancelar</SecondaryButton>
 * </ButtonGroup>
 * ```
 */
export function ButtonGroup({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return <View className={cn("gap-3", className)}>{children}</View>;
}
