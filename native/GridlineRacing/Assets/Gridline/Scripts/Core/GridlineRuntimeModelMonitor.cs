using GLTFast;
using UnityEngine;

namespace Gridline.Native
{
    public sealed class GridlineRuntimeModelMonitor : MonoBehaviour
    {
        public GltfAsset Asset;
        public Renderer[] FallbackRenderers;
        public float FallbackDelay = 12f;
        public bool HideFallbackWhenReady = true;

        private bool modelReady;
        private bool fallbackShown;

        private void Update()
        {
            if (Asset != null && Asset.SceneInstance != null)
            {
                if (!modelReady)
                {
                    modelReady = true;
                    AdaptBuiltInMaterials();
                    if (HideFallbackWhenReady)
                    {
                        SetFallbackVisible(false);
                    }
                    LogBounds();
                }

                return;
            }

            if (!fallbackShown && Time.unscaledTime >= FallbackDelay)
            {
                SetFallbackVisible(true);
                Debug.LogWarning($"Gridline GLB fallback aktiv: {name}");
            }
        }

        private void SetFallbackVisible(bool visible)
        {
            fallbackShown = visible;
            if (FallbackRenderers == null)
            {
                return;
            }

            foreach (Renderer fallbackRenderer in FallbackRenderers)
            {
                if (fallbackRenderer != null)
                {
                    fallbackRenderer.enabled = visible;
                }
            }
        }

        private void LogBounds()
        {
            Renderer[] renderers = GetComponentsInChildren<Renderer>(true);
            Bounds bounds = default;
            bool hasBounds = false;
            foreach (Renderer renderer in renderers)
            {
                if (!hasBounds)
                {
                    bounds = renderer.bounds;
                    hasBounds = true;
                }
                else
                {
                    bounds.Encapsulate(renderer.bounds);
                }
            }

            if (hasBounds)
            {
                Debug.Log($"Gridline GLB geladen: {name} bounds center={bounds.center} size={bounds.size} renderers={renderers.Length}");
            }
        }

        private void AdaptBuiltInMaterials()
        {
            Shader standardShader = Shader.Find("Standard");
            if (standardShader == null)
            {
                standardShader = Shader.Find("Legacy Shaders/Diffuse");
            }
            if (standardShader == null)
            {
                standardShader = Shader.Find("Diffuse");
            }
            if (standardShader == null)
            {
                Debug.LogWarning($"Gridline Material-Adapter: kein Built-in Shader fuer {name} verfuegbar");
                return;
            }

            Renderer[] renderers = GetComponentsInChildren<Renderer>(true);
            int loggedMaterials = 0;
            foreach (Renderer renderer in renderers)
            {
                Material[] sourceMaterials = renderer.sharedMaterials;
                if (sourceMaterials == null || sourceMaterials.Length == 0)
                {
                    renderer.sharedMaterial = CreateFallbackMaterial(standardShader, renderer.name);
                    continue;
                }

                Material[] adaptedMaterials = new Material[sourceMaterials.Length];
                for (int i = 0; i < sourceMaterials.Length; i += 1)
                {
                    Material source = sourceMaterials[i];
                    if (source == null)
                    {
                        adaptedMaterials[i] = new Material(standardShader);
                        continue;
                    }

                    Material adapted = new Material(standardShader)
                    {
                        name = $"{source.name} (Built-in)"
                    };
                    if (adapted.HasProperty("_Cull"))
                    {
                        adapted.SetInt("_Cull", 0);
                    }

                    if (source.HasProperty("baseColorTexture") && source.GetTexture("baseColorTexture") != null)
                    {
                        adapted.SetTexture("_MainTex", source.GetTexture("baseColorTexture"));
                    }

                    if (source.HasProperty("baseColorFactor"))
                    {
                        Vector4 factor = source.GetVector("baseColorFactor");
                        adapted.color = new Color(factor.x, factor.y, factor.z, factor.w);
                    }

                    if (loggedMaterials < 4)
                    {
                        Debug.Log($"Gridline Material: {source.name} shader={source.shader.name} sourceColor={adapted.color} texture={adapted.GetTexture("_MainTex") != null}");
                        loggedMaterials += 1;
                    }

                    if (source.HasProperty("metallicFactor"))
                    {
                        adapted.SetFloat("_Metallic", source.GetFloat("metallicFactor"));
                    }

                    if (source.HasProperty("roughnessFactor"))
                    {
                        adapted.SetFloat("_Glossiness", 1f - source.GetFloat("roughnessFactor"));
                    }

                    adaptedMaterials[i] = adapted;
                }

                renderer.sharedMaterials = adaptedMaterials;
            }

            Debug.Log($"Gridline Material-Adapter: {name} renderers={renderers.Length}");
        }

        private Material CreateFallbackMaterial(Shader standardShader, string rendererName)
        {
            bool isVehicle = name.Contains("Ferrari");
            string lowerName = rendererName.ToLowerInvariant();
            Color color = isVehicle
                ? new Color(0.72f, 0.025f, 0.035f)
                : lowerName.Contains("grass") || lowerName.Contains("terrain")
                    ? new Color(0.16f, 0.38f, 0.12f)
                    : lowerName.Contains("kerb") || lowerName.Contains("curb")
                        ? new Color(0.82f, 0.06f, 0.05f)
                        : lowerName.Contains("asph") || lowerName.Contains("road")
                            ? new Color(0.12f, 0.14f, 0.16f)
                            : new Color(0.45f, 0.48f, 0.52f);

            Material fallback = new Material(standardShader)
            {
                name = $"{name} fallback material",
                color = color
            };
            if (fallback.HasProperty("_Cull"))
            {
                fallback.SetInt("_Cull", 0);
            }

            return fallback;
        }
    }
}
