using GLTFast;
using System.Text;
using UnityEngine;

namespace Gridline.Native
{
    public sealed class GridlineRuntimeModelMonitor : MonoBehaviour
    {
        public enum ModelKind
        {
            Track,
            Vehicle
        }

        public GltfAsset Asset;
        public GridlineVehicleController Vehicle;
        public ModelKind Kind;
        public string AssetUrl;
        public string SourceLabel;
        public string TextureFolder;

        private bool modelReady;
        private float startedAt;
        private bool reportedFailure;

        private void Awake()
        {
            startedAt = Time.unscaledTime;
        }

        private void Update()
        {
            if (Asset != null && Asset.SceneInstance != null)
            {
                if (modelReady) return;
                modelReady = true;
                ConfigureImportedModel();
                LogBounds();
                return;
            }

            if (!reportedFailure && Time.unscaledTime - startedAt > 60f)
            {
                reportedFailure = true;
                Debug.LogError($"Gridline GLB konnte nicht geladen werden: {name}. Erwartet: StreamingAssets/{Asset?.Url}");
            }
        }

        private void ConfigureImportedModel()
        {
            Renderer[] renderers = GetComponentsInChildren<Renderer>(true);
            int disabledEnvironmentRenderers = 0;
            int disabledLowQualityRenderers = 0;
            Shader visibleShader = Kind == ModelKind.Track
                ? Resources.Load<Shader>("Graphics/Shaders/Built-In/GridlineFlatColor")
                    ?? Resources.Load<Shader>("Graphics/Shaders/Built-In/GridlineLitColor")
                : Resources.Load<Shader>("Graphics/Shaders/Built-In/GridlineLitColor")
                    ?? Resources.Load<Shader>("Graphics/Shaders/Built-In/GridlineFlatColor")
                    ?? Shader.Find("Unlit/Color");
            foreach (Renderer renderer in renderers)
            {
                if (Kind == ModelKind.Track && IsEnvironmentOccluder(renderer))
                {
                    renderer.enabled = false;
                    disabledEnvironmentRenderers += 1;
                    continue;
                }

                if (Kind == ModelKind.Track && UseLowQualityTrackVisuals()
                    && IsLowQualityEnvironment(renderer))
                {
                    renderer.enabled = false;
                    disabledLowQualityRenderers += 1;
                    continue;
                }

                renderer.receiveShadows = true;
                renderer.shadowCastingMode = Kind == ModelKind.Vehicle
                    ? UnityEngine.Rendering.ShadowCastingMode.On
                    : UnityEngine.Rendering.ShadowCastingMode.Off;

                if (visibleShader != null)
                {
                    renderer.sharedMaterials = CreateVisibleMaterials(
                        renderer.sharedMaterials, visibleShader, Kind, TextureFolder);
                }
                else
                {
                    foreach (Material material in renderer.sharedMaterials)
                    {
                        if (material != null) material.enableInstancing = true;
                    }
                }
            }

            if (disabledEnvironmentRenderers > 0)
            {
                Debug.Log($"Gridline GLB-Umwelt bereinigt: {name} · ausgeblendet={disabledEnvironmentRenderers}");
            }
            if (disabledLowQualityRenderers > 0)
            {
                Debug.Log($"Gridline Low-Quality-Trackvisual: {name} · Umwelt-Renderer ausgeblendet={disabledLowQualityRenderers} "
                    + "· Fahrbahn/kerbs/oberflächen/barrieren bleiben aktiv");
            }

            if (Kind == ModelKind.Vehicle && Vehicle != null)
            {
                Vehicle.BindVisualModel(transform);
            }
            else if (Kind == ModelKind.Track)
            {
                GridlineTrackCollision.Build(transform);
                Debug.Log($"Gridline track authority: visibleModel={name} asset={AssetUrl ?? Asset?.Url ?? "unknown"} "
                    + $"source={SourceLabel ?? "original imported GLB"} generated=false "
                    + $"localPosition={transform.localPosition} localScale={transform.localScale} "
                    + "collisionSource=imported GLB material subsets");

                // Diagnostic-only A/B switch. Collision remains built from the
                // imported GLB; this isolates render cost from physics cost.
                if (HasArgument("-gridline-qa-hide-track-visual"))
                {
                    foreach (Renderer renderer in GetComponentsInChildren<Renderer>(true))
                        renderer.enabled = false;
                    Debug.Log("Gridline render diagnostic: imported track visual disabled; collision remains active");
                }
            }
        }

        private static bool HasArgument(string expected)
        {
            string[] args = System.Environment.GetCommandLineArgs();
            for (int i = 0; i < args.Length; i += 1)
                if (string.Equals(args[i], expected, System.StringComparison.OrdinalIgnoreCase)) return true;
            return false;
        }

        private static bool UseLowQualityTrackVisuals()
        {
            // The reference GLB stays authoritative for collision and track
            // surfaces. On iPad and on the default cross-platform profile,
            // remove only long-range scenery so the real driving surface can
            // hold a stable frame rate. Developers can inspect the full GLB
            // with -gridline-high-quality when required.
            return Application.isMobilePlatform || !HasArgument("-gridline-high-quality");
        }

        private static bool IsLowQualityEnvironment(Renderer renderer)
        {
            foreach (Material material in renderer.sharedMaterials)
            {
                string name = (material != null ? material.name : string.Empty).ToLowerInvariant();
                if (name.Contains("metals1") || name.Contains("objects")
                    || name.Contains("structure") || name.Contains("tree")
                    || name.Contains("tractor") || name.Contains("marshall")
                    || name.Contains("misc") || name.Contains("gazebo")
                    || name.Contains("jersey") || name.Contains("gstand")
                    || name.Contains("cameraman") || name.Contains("tv_stuff")
                    || name.Contains("box1") || name.Contains("box2")
                    || name.Contains("sprinter") || name.Contains("bridge")
                    || name.Contains("hotel") || name.Contains("flag")
                    || name.Contains("tile") || name.Contains("glass")
                    || name.Contains("stone") || name.Contains("serraglio")
                    || name.Contains("walls2") || name.Contains("distanz")
                    || name.Contains("top2") || name.Contains("miscalpha"))
                {
                    return true;
                }
            }
            return false;
        }

        private static Material[] CreateVisibleMaterials(Material[] sourceMaterials, Shader shader,
            ModelKind kind, string configuredTextureFolder)
        {
            Material[] visibleMaterials = new Material[sourceMaterials.Length];
            for (int i = 0; i < sourceMaterials.Length; i += 1)
            {
                Material source = sourceMaterials[i];
                if (source == null)
                {
                    visibleMaterials[i] = null;
                    continue;
                }

                Material visible = new Material(shader)
                {
                    name = source.name + " · Gridline visible",
                    enableInstancing = true,
                    renderQueue = 2000
                };

                Color semanticColor = SemanticColor(source.name, kind);
                string textureFolder = !string.IsNullOrEmpty(configuredTextureFolder)
                    ? configuredTextureFolder
                    : kind == ModelKind.Track ? "SilverstoneGP" : "Ferrari296";
                Texture baseColorTexture = Resources.Load<Texture2D>(
                    $"Graphics/GLBTextures/{textureFolder}/{SanitizeMaterialName(source.name)}");
                if (baseColorTexture != null && visible.HasProperty("_MainTex"))
                {
                    // BaseColor is extracted into ordinary Unity Resources at
                    // build time. This avoids the black runtime texture path
                    // seen with embedded glTF images on Metal.
                    visible.SetTexture("_MainTex", baseColorTexture);
                    if (visible.HasProperty("_TextureMix"))
                    {
                        float textureMix = TextureMixFor(source.name, kind);
                        visible.SetFloat("_TextureMix", textureMix);
                    }
                }
                else if (visible.HasProperty("_TextureMix"))
                {
                    visible.SetFloat("_TextureMix", 0f);
                }
                visible.color = semanticColor;
                if (visible.HasProperty("_Color")) visible.SetColor("_Color", semanticColor);
                if (visible.HasProperty("_BaseColor")) visible.SetColor("_BaseColor", semanticColor);
                if (visible.HasProperty("_Cull")) visible.SetFloat("_Cull", 0f);
                if (visible.HasProperty("_CullMode")) visible.SetFloat("_CullMode", 0f);
                visibleMaterials[i] = visible;
            }

            return visibleMaterials;
        }

        private static string SanitizeMaterialName(string value)
        {
            StringBuilder builder = new StringBuilder(value.Length);
            foreach (char character in value)
            {
                builder.Append(char.IsLetterOrDigit(character) || character == '_' || character == '-'
                    ? character
                    : '_');
            }

            return builder.ToString().Trim('_');
        }

        private static bool IsDarkVehiclePaint(string materialName)
        {
            string name = materialName.ToLowerInvariant();
            return name.Contains("carpaint") || name.Contains("details") || name.Contains("banner");
        }

        private static float TextureMixFor(string materialName, ModelKind kind)
        {
            if (kind == ModelKind.Vehicle)
            {
                return IsDarkVehiclePaint(materialName) ? 0.36f : 1f;
            }

            string name = materialName.ToLowerInvariant();
            if (name.Contains("asphalt") || name.Contains("asph") || name.Contains("groove")
                || name.Contains("grass") || name.Contains("curb") || name.Contains("kerb"))
                return 1f;
            if (name.Contains("structure") || name.Contains("stand") || name.Contains("hotel")
                || name.Contains("bridge") || name.Contains("object"))
                return 0.58f;
            return 0.82f;
        }

        private static Color SemanticColor(string materialName, ModelKind kind)
        {
            string name = materialName.ToLowerInvariant();
            if (kind == ModelKind.Vehicle)
            {
                if (name.Contains("glass") || name.Contains("window")) return new Color(0.04f, 0.16f, 0.24f);
                if (name.Contains("tyre") || name.Contains("tire") || name.Contains("rubber")
                    || name.Contains("carbon") || name.Contains("plastic") || name.Contains("chassis"))
                    return new Color(0.035f, 0.045f, 0.055f);
                if (name.Contains("metal") || name.Contains("rim") || name.Contains("brake")
                    || name.Contains("disc") || name.Contains("steel")) return new Color(0.52f, 0.56f, 0.61f);
                if (name.Contains("lamp") || name.Contains("light") || name.Contains("led")) return new Color(1f, 0.12f, 0.08f);
                if (name.Contains("carpaint")) return new Color(0.72f, 0.025f, 0.035f);
                return new Color(0.58f, 0.07f, 0.06f);
            }

            if (name.Contains("asphalt") || name.Contains("asph") || name.Contains("groove") || name.Contains("road"))
                return new Color(0.18f, 0.20f, 0.22f);
            if (name.Contains("grass") || name.Contains("tree")) return new Color(0.16f, 0.38f, 0.13f);
            if (name.Contains("sand") || name.Contains("gravel") || name.Contains("stone")) return new Color(0.62f, 0.48f, 0.28f);
            if (name.Contains("curb") || name.Contains("kerb") || name.Contains("rumble")) return new Color(0.82f, 0.10f, 0.08f);
            if (name.Contains("fence") || name.Contains("barrier") || name.Contains("wall")) return new Color(0.25f, 0.28f, 0.31f);
            if (name.Contains("stand") || name.Contains("structure") || name.Contains("building") || name.Contains("hotel")) return new Color(0.50f, 0.53f, 0.56f);
            if (name.Contains("metal") || name.Contains("object") || name.Contains("concrete"))
                return new Color(0.42f, 0.46f, 0.50f);
            return new Color(0.38f, 0.42f, 0.46f);
        }

        private static bool IsEnvironmentOccluder(Renderer renderer)
        {
            // Some supplied track GLBs use a top2/sky shell for the far
            // horizon. It is a real mesh, so a camera sees it as a sheet in
            // Unity even though the browser removes it.
            foreach (Material material in renderer.sharedMaterials)
            {
                string materialName = material != null ? material.name : string.Empty;
                if (materialName.StartsWith("top2", System.StringComparison.OrdinalIgnoreCase)
                    || materialName.IndexOf("sky", System.StringComparison.OrdinalIgnoreCase) >= 0
                    || materialName.IndexOf("dome", System.StringComparison.OrdinalIgnoreCase) >= 0
                    || materialName.IndexOf("firmament", System.StringComparison.OrdinalIgnoreCase) >= 0)
                {
                    return true;
                }
            }

            return false;
        }

        private void LogBounds()
        {
            Renderer[] renderers = GetComponentsInChildren<Renderer>(true);
            if (renderers.Length == 0)
            {
                Debug.LogError($"Gridline GLB ohne Renderer: {name}");
                return;
            }

            Bounds bounds = renderers[0].bounds;
            for (int i = 1; i < renderers.Length; i += 1) bounds.Encapsulate(renderers[i].bounds);
            Debug.Log($"Gridline GLB integriert: {name} bounds center={bounds.center} size={bounds.size} renderers={renderers.Length}");

        }
    }
}
