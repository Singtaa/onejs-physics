using System;
using System.Runtime.InteropServices;
using UnityEngine;

namespace OneJS.Physics {
    /// <summary>
    /// Hands this package's native WebAssembly modules to OneJS, so every
    /// QuickJS context serves them to oj as <c>__wasm</c> in place of the
    /// WebAssembly a browser has. Runs before any scene loads in a player, and
    /// on every domain load in the editor, where edit-mode previews run too.
    /// Registering a module twice is harmless.
    ///
    /// Not compiled for WebGL, where the browser runs the module itself.
    /// </summary>
    static class PhysicsModules {
#if UNITY_IOS && !UNITY_EDITOR
        const string Rapier3D = "__Internal";
#else
        const string Rapier3D = "onejs_rapier3d";
#endif

        [DllImport(Rapier3D, CallingConvention = CallingConvention.Cdecl)]
        static extern IntPtr onejs_wasm_rapier3d();

        [RuntimeInitializeOnLoadMethod(RuntimeInitializeLoadType.SubsystemRegistration)]
        static void Register() {
            Add("rapier3d", onejs_wasm_rapier3d);
        }

#if UNITY_EDITOR
        [UnityEditor.InitializeOnLoadMethod]
        static void RegisterInEditor() => Register();
#endif

        static void Add(string name, Func<IntPtr> table) {
            try {
                if (!QuickJSNative.RegisterWasmModule(table())) {
                    Debug.LogWarning($"[OneJS Physics] OneJS refused the native {name} module: it reads a different " +
                                     "module table than this library was built for. Update OneJS and onejs-physics together.");
                }
            } catch (DllNotFoundException) {
                Debug.LogWarning($"[OneJS Physics] There is no native {name} library for this platform. A git install " +
                                 "of onejs-physics carries none; install a release tarball (see its README).");
            } catch (EntryPointNotFoundException) {
                Debug.LogWarning($"[OneJS Physics] The native {name} library does not export onejs_wasm_{name}.");
            }
        }
    }
}
