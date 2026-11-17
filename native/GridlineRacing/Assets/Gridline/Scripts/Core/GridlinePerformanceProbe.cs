using UnityEngine;

namespace Gridline.Native
{
    [DefaultExecutionOrder(900)]
    public sealed class GridlinePerformanceProbe : MonoBehaviour
    {
        private const float ReportInterval = 5f;
        private float reportStartedAt;
        private int renderFrames;
        private int fixedSteps;
        private float fpsSum;
        private float fpsMin = float.PositiveInfinity;
        private float fpsMax;

        private void Awake()
        {
            reportStartedAt = Time.realtimeSinceStartup;
        }

        private void Update()
        {
            float delta = Time.unscaledDeltaTime;
            if (delta <= 0.0001f) return;

            float instantFps = 1f / delta;
            renderFrames += 1;
            fpsSum += instantFps;
            fpsMin = Mathf.Min(fpsMin, instantFps);
            fpsMax = Mathf.Max(fpsMax, instantFps);
        }

        private void FixedUpdate()
        {
            fixedSteps += 1;
        }

        private void LateUpdate()
        {
            float elapsed = Time.realtimeSinceStartup - reportStartedAt;
            if (elapsed < ReportInterval) return;

            float averageFps = renderFrames > 0 ? fpsSum / renderFrames : 0f;
            float fixedFps = fixedSteps / Mathf.Max(elapsed, 0.001f);
            Debug.Log(
                $"Gridline PERF target={Application.targetFrameRate} " +
                $"render={averageFps:0.0}fps min={fpsMin:0.0} max={fpsMax:0.0} " +
                $"fixed={fixedFps:0.0}Hz step={Time.fixedDeltaTime:0.000000}s");

            reportStartedAt = Time.realtimeSinceStartup;
            renderFrames = 0;
            fixedSteps = 0;
            fpsSum = 0f;
            fpsMin = float.PositiveInfinity;
            fpsMax = 0f;
        }
    }
}
