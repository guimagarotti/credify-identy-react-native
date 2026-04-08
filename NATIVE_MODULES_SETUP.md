# Setup de Módulos Nativos - Credify React Native

Guia completo para configurar e registrar os módulos nativos Android e iOS no projeto React Native.

## Visão Geral

Os módulos nativos foram criados e precisam ser registrados no React Native Bridge para serem acessíveis via JavaScript. Este documento detalha o processo de setup para ambas as plataformas.

## Android Setup

### 1. Estrutura de Diretórios

Os arquivos Kotlin estão localizados em:

```
android/app/src/main/kotlin/
├── com/credify/
│   ├── CredifySdkModule.kt       (Módulo principal)
│   ├── CameraManager.kt          (Gerenciador de câmera)
│   └── WasmModule.kt             (Carregador de WASM)
└── com/credify/
    ├── MainActivity.kt           (Activity principal)
    └── MainApplication.kt        (Aplicação com registro de módulos)
```

### 2. Registrar MainApplication.kt

O arquivo `MainApplication.kt` já contém o registro do módulo. Certifique-se de que está configurado em `android/app/src/main/AndroidManifest.xml`:

```xml
<application
    android:name=".MainApplication"
    ...>
    <activity
        android:name=".MainActivity"
        ...>
    </activity>
</application>
```

### 3. Adicionar Dependências no build.gradle

Adicione as dependências necessárias em `android/app/build.gradle`:

```gradle
dependencies {
    // React Native
    implementation 'com.facebook.react:react-native:+'
    
    // Wasmer (para processamento WASM)
    // Opção 1: wasmer-java
    implementation 'com.wasmer:wasmer-jni:1.1.1'
    
    // Ou Opção 2: wasmtime-java
    // implementation 'org.bytecodealliance:wasmtime-java:1.0.0'
    
    // Kotlin
    implementation "org.jetbrains.kotlin:kotlin-stdlib:1.8.0"
    
    // Coroutines
    implementation "org.jetbrains.kotlinx:kotlinx-coroutines-android:1.6.4"
}
```

### 4. Compilar e Testar

```bash
# Limpar build
cd android
./gradlew clean

# Build
./gradlew assembleDebug

# Instalar em emulador/dispositivo
./gradlew installDebug

# Executar
adb shell am start -n com.credify/com.credify.MainActivity
```

### 5. Verificar Registro

No JavaScript, verifique se o módulo está disponível:

```typescript
import { NativeModules } from 'react-native';

console.log('Módulos disponíveis:', Object.keys(NativeModules));
console.log('CredifySdkModule:', NativeModules.CredifySdkModule);
```

## iOS Setup

### 1. Estrutura de Diretórios

Os arquivos Swift estão localizados em:

```
ios/CredifySdk/
├── CredifySdkModule.swift        (Módulo principal)
├── CredifySdkModule+Bridge.m     (Bridge Objective-C)
├── CameraManager.swift           (Gerenciador de câmera)
└── WasmModule.swift              (Carregador de WASM)
```

### 2. Registrar no Xcode

1. Abra `ios/CredifySdk.xcworkspace` no Xcode
2. Adicione os arquivos Swift ao target do app:
   - Selecione `File > Add Files to "CredifySdk"`
   - Navegue até `ios/CredifySdk/`
   - Selecione `CredifySdkModule.swift`, `CameraManager.swift`, `WasmModule.swift`
   - Certifique-se de que o target está selecionado

3. Adicione o arquivo Bridge Objective-C:
   - `File > Add Files to "CredifySdk"`
   - Selecione `CredifySdkModule+Bridge.m`

### 3. Configurar Bridging Header (se necessário)

Se o projeto não tiver um Bridging Header, crie um:

1. `File > New > File > Header File`
2. Nomeie como `CredifySdk-Bridging-Header.h`
3. Adicione:

```objc
//
//  CredifySdk-Bridging-Header.h
//

#ifndef CredifySdk_Bridging_Header_h
#define CredifySdk_Bridging_Header_h

#import <React/RCTBridgeModule.h>

#endif /* CredifySdk_Bridging_Header_h */
```

4. Configure em Build Settings:
   - Selecione o target
   - Build Settings > Search Paths
   - Objective-C Bridging Header = `CredifySdk/CredifySdk-Bridging-Header.h`

### 4. Adicionar Dependências no Podfile

Edite `ios/Podfile` e adicione:

```ruby
target 'CredifySdk' do
  # ... dependências existentes ...
  
  # Wasmer (para processamento WASM)
  # Opção 1: wasmer-swift (recomendado)
  # pod 'Wasmer', '~> 1.1.0'
  
  # Ou Opção 2: wasmtime-swift
  # pod 'Wasmtime', '~> 1.0.0'
end
```

### 5. Instalar Pods

```bash
cd ios
pod install
cd ..
```

### 6. Compilar e Testar

```bash
# Compilar
xcodebuild -workspace ios/CredifySdk.xcworkspace \
           -scheme CredifySdk \
           -configuration Debug \
           -derivedDataPath ios/build

# Ou usar React Native CLI
npx react-native run-ios
```

### 7. Verificar Registro

No JavaScript, verifique se o módulo está disponível:

```typescript
import { NativeModules } from 'react-native';

console.log('Módulos disponíveis:', Object.keys(NativeModules));
console.log('CredifySdkModule:', NativeModules.CredifySdkModule);
```

## Implementação de WASM Real

### Android (Kotlin)

Para usar WASM real, escolha uma biblioteca:

#### Opção 1: Wasmer Java (Recomendado)

```kotlin
import com.wasmer.api.*

val store = Store()
val module = Module(store, wasmBuffer!!)
val instance = Instance(module, store)
val processFunction = instance.exports.getFunction("process_frame")
val result = processFunction.invoke(store, frameData)
```

#### Opção 2: Wasmtime Java

```kotlin
val engine = Engine()
val module = Module.fromBinary(engine, wasmBuffer!!)
val store = Store(engine)
val instance = Instance(store, module, emptyArray())
val processFunc = instance.getExport("process_frame") as Function
val result = processFunc.call(store, frameData)
```

### iOS (Swift)

Para usar WASM real, escolha uma biblioteca:

#### Opção 1: Wasmer Swift (Recomendado)

```swift
import Wasmer

let engine = Engine()
let module = try Module(engine: engine, bytes: wasmBuffer!)
let store = Store(engine: engine)
let instance = try Instance(store: store, module: module)
let processFunc = try instance.exports.function(named: "process_frame")
let result = try processFunc.call([frameData])
```

#### Opção 2: Wasmtime Swift

```swift
import Wasmtime

let engine = Engine()
let module = try Module(engine: engine, data: wasmBuffer!)
let store = Store(engine: engine)
let instance = try Instance(store: store, module: module)
let processFunc = instance.getExport(named: "process_frame")
let result = try processFunc?.call([frameData])
```

## Testes de Integração

### Teste JavaScript

```typescript
import { CredifyBridge } from '@/lib/native-credify-bridge';

async function testNativeModule() {
  try {
    // Inicializar
    const initResult = await CredifyBridge.initialize({
      modelUrl: 'https://api.example.com/models',
      pubKeyUrl: 'https://api.example.com/pub_key',
    });
    console.log('Inicialização:', initResult);

    // Capturar
    const captureResult = await CredifyBridge.capture();
    console.log('Captura:', captureResult);

    // Obter feedback
    const feedback = await CredifyBridge.getFeedback();
    console.log('Feedback:', feedback);

    // Liberar
    const releaseResult = await CredifyBridge.release();
    console.log('Liberação:', releaseResult);
  } catch (error) {
    console.error('Erro:', error);
  }
}

testNativeModule();
```

### Teste Android (Kotlin)

```kotlin
// Em um teste de integração
@Test
fun testCredifySdkModule() {
    val context = InstrumentationRegistry.getInstrumentation().targetContext
    val reactContext = ReactApplicationContext(context)
    val module = CredifySdkModule(reactContext)

    // Testar inicialização
    val options = WritableNativeMap().apply {
        putString("modelUrl", "https://api.example.com/models")
        putString("pubKeyUrl", "https://api.example.com/pub_key")
    }

    module.initialize(options, { result ->
        assertEquals("initialized", result.getString("status"))
    }, { error ->
        fail(error.toString())
    })
}
```

### Teste iOS (Swift)

```swift
// Em um teste de integração
func testCredifySdkModule() {
    let module = CredifySdkModule()

    let options: [String: Any] = [
        "modelUrl": "https://api.example.com/models",
        "pubKeyUrl": "https://api.example.com/pub_key"
    ]

    module.initialize(options, withResolver: { result in
        XCTAssertEqual(result["status"] as? String, "initialized")
    }, andRejecter: { code, message, error in
        XCTFail(message ?? "Erro desconhecido")
    })
}
```

## Troubleshooting

### Android

**Erro: "CredifySdkModule not found"**
- Certifique-se de que `MainApplication.kt` está registrado em `AndroidManifest.xml`
- Limpe o build: `./gradlew clean`
- Reconstrua: `./gradlew assembleDebug`

**Erro: "Cannot resolve symbol 'com.wasmer'"**
- Adicione a dependência wasmer-java em `build.gradle`
- Execute `./gradlew sync`

### iOS

**Erro: "CredifySdkModule not found"**
- Certifique-se de que os arquivos Swift estão adicionados ao target
- Verifique o Bridging Header em Build Settings
- Limpe o build: `Cmd + Shift + K`

**Erro: "Module not registered"**
- Certifique-se de que `CredifySdkModule+Bridge.m` está incluído
- Verifique que o módulo está em `RCT_EXTERN_MODULE`

## Próximos Passos

1. **Implementar WASM real:** Escolha uma biblioteca WASM (Wasmer ou Wasmtime) e implemente a lógica real de processamento
2. **Testes end-to-end:** Teste em dispositivos reais Android e iOS
3. **Performance:** Otimize o processamento de frames e gerenciamento de memória
4. **CI/CD:** Configure builds automáticos no GitHub Actions ou similar

## Referências

- [React Native Native Modules](https://reactnative.dev/docs/native-modules-intro)
- [Wasmer Java](https://docs.wasmer.io/language-bindings/java)
- [Wasmtime Java](https://docs.wasmtime.dev/)
- [Wasmer Swift](https://docs.wasmer.io/language-bindings/swift)
- [Wasmtime Swift](https://docs.wasmtime.dev/)
