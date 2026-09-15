using UnityEngine;

namespace Gridline.Native
{
    [DefaultExecutionOrder(-1000)]
    public sealed class GridlineBootstrap : MonoBehaviour
    {
        private const string RuntimeRootName = "__GridlineNativeRuntime";

        [RuntimeInitializeOnLoadMethod(RuntimeInitializeLoadType.AfterSceneLoad)]
        private static void Boot()
        {
            if (Object.FindFirstObjectByType<GridlineBootstrap>() != null)
            {
                return;
            }

            GameObject runtimeRoot = new GameObject(RuntimeRootName);
            DontDestroyOnLoad(runtimeRoot);
            runtimeRoot.AddComponent<GridlineBootstrap>();
        }

        private void Awake()
        {
            Application.targetFrameRate = 120;
            QualitySettings.vSyncCount = 0;
            Time.fixedDeltaTime = 1f / 60f;
            Time.maximumDeltaTime = 0.1f;

            GridlineRuntimeBuilder.BuildIfNeeded();
            GridlineGameState.ReturnToMenu();
        }
    }
}
