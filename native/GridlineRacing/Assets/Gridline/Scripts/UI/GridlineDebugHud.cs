using UnityEngine;

namespace Gridline.Native
{
    public sealed class GridlineDebugHud : MonoBehaviour
    {
        public GridlineVehicleController Vehicle;

        private GUIStyle titleStyle;
        private GUIStyle labelStyle;
        private GUIStyle valueStyle;
        private GUIStyle menuTitleStyle;
        private GUIStyle menuTextStyle;
        private float fps;

        private void Update()
        {
            float instantFps = Time.unscaledDeltaTime > 0.0001f ? 1f / Time.unscaledDeltaTime : 0f;
            fps = Mathf.Lerp(fps <= 0f ? instantFps : fps, instantFps, 0.06f);
        }

        private void OnGUI()
        {
            EnsureStyles();

            if (Vehicle == null)
            {
                GUI.Label(new Rect(20f, 20f, 320f, 30f), "Gridline Native: no vehicle reference", labelStyle);
                return;
            }

            if (GridlineGameState.IsMenu)
            {
                DrawMenu();
            }
            else
            {
                DrawTelemetry();
                if (GridlineGameState.IsPaused)
                {
                    DrawPaused();
                }
            }
        }

        private void DrawTelemetry()
        {
            const float panelWidth = 330f;
            const float panelHeight = 252f;
            Rect panel = new Rect(22f, Screen.height - panelHeight - 22f, panelWidth, panelHeight);
            DrawPanel(panel, new Color(0.015f, 0.018f, 0.023f, 0.88f));

            GUI.Label(new Rect(panel.x + 18f, panel.y + 14f, 220f, 24f), "GRIDLINE NATIVE", titleStyle);
            GUI.Label(new Rect(panel.x + 236f, panel.y + 14f, 74f, 24f), $"{fps:000} FPS", valueStyle);

            GUI.Label(new Rect(panel.x + 18f, panel.y + 48f, 110f, 22f), "SPEED", labelStyle);
            GUI.Label(new Rect(panel.x + 128f, panel.y + 44f, 180f, 28f), $"{Vehicle.SpeedKph:000} km/h", valueStyle);

            GUI.Label(new Rect(panel.x + 18f, panel.y + 76f, 110f, 22f), "GEAR", labelStyle);
            GUI.Label(new Rect(panel.x + 128f, panel.y + 72f, 180f, 28f), $"{Vehicle.Gear}", valueStyle);

            GUI.Label(new Rect(panel.x + 18f, panel.y + 104f, 110f, 22f), "RPM", labelStyle);
            GUI.Label(new Rect(panel.x + 128f, panel.y + 100f, 180f, 28f), $"{Vehicle.Rpm:00000}", valueStyle);

            DrawBar(new Rect(panel.x + 18f, panel.y + 138f, 294f, 12f), Vehicle.ThrottleInput, new Color(0.1f, 0.82f, 0.38f), "THR");
            DrawBar(new Rect(panel.x + 18f, panel.y + 166f, 294f, 12f), Vehicle.BrakeInput, new Color(0.95f, 0.12f, 0.1f), "BRK");
            DrawSignedBar(new Rect(panel.x + 18f, panel.y + 194f, 294f, 12f), Vehicle.SteerInput, new Color(0.18f, 0.56f, 1f), "STR");

            GUI.Label(new Rect(panel.x + 18f, panel.y + 218f, 135f, 22f), $"LAT G {Vehicle.LateralG:+0.00;-0.00;0.00}", labelStyle);
            GUI.Label(new Rect(panel.x + 176f, panel.y + 218f, 135f, 22f), $"LONG G {Vehicle.LongitudinalG:+0.00;-0.00;0.00}", labelStyle);
        }

        private void DrawMenu()
        {
            Rect panel = new Rect(Screen.width * 0.5f - 260f, Screen.height * 0.5f - 145f, 520f, 290f);
            DrawPanel(panel, new Color(0.01f, 0.012f, 0.016f, 0.93f));

            GUI.Label(new Rect(panel.x + 30f, panel.y + 30f, panel.width - 60f, 56f), "GRIDLINE", menuTitleStyle);
            GUI.Label(new Rect(panel.x + 32f, panel.y + 92f, panel.width - 64f, 30f), "DRIVING TEST BUILD", menuTextStyle);
            GUI.Label(new Rect(panel.x + 32f, panel.y + 142f, panel.width - 64f, 26f), "Enter: start driving", menuTextStyle);
            GUI.Label(new Rect(panel.x + 32f, panel.y + 174f, panel.width - 64f, 26f), "WASD / arrows: drive", menuTextStyle);
            GUI.Label(new Rect(panel.x + 32f, panel.y + 206f, panel.width - 64f, 26f), "Space: handbrake   R: reset   Esc: menu", menuTextStyle);
        }

        private void DrawPaused()
        {
            Rect panel = new Rect(Screen.width * 0.5f - 190f, Screen.height * 0.5f - 70f, 380f, 140f);
            DrawPanel(panel, new Color(0.01f, 0.012f, 0.016f, 0.93f));
            GUI.Label(new Rect(panel.x + 30f, panel.y + 28f, panel.width - 60f, 40f), "PAUSED", menuTitleStyle);
            GUI.Label(new Rect(panel.x + 32f, panel.y + 82f, panel.width - 64f, 26f), "P: continue   Esc: menu", menuTextStyle);
        }

        private void DrawBar(Rect rect, float value, Color fillColor, string label)
        {
            GUI.Label(new Rect(rect.x, rect.y - 18f, 52f, 18f), label, labelStyle);
            DrawPanel(rect, new Color(1f, 1f, 1f, 0.08f));
            Rect fill = new Rect(rect.x, rect.y, rect.width * Mathf.Clamp01(value), rect.height);
            GUI.color = fillColor;
            GUI.DrawTexture(fill, Texture2D.whiteTexture);
            GUI.color = Color.white;
        }

        private void DrawSignedBar(Rect rect, float value, Color fillColor, string label)
        {
            GUI.Label(new Rect(rect.x, rect.y - 18f, 52f, 18f), label, labelStyle);
            DrawPanel(rect, new Color(1f, 1f, 1f, 0.08f));

            float center = rect.x + rect.width * 0.5f;
            float width = rect.width * 0.5f * Mathf.Abs(Mathf.Clamp(value, -1f, 1f));
            Rect fill = value >= 0f
                ? new Rect(center, rect.y, width, rect.height)
                : new Rect(center - width, rect.y, width, rect.height);

            GUI.color = fillColor;
            GUI.DrawTexture(fill, Texture2D.whiteTexture);
            GUI.color = Color.white;
        }

        private static void DrawPanel(Rect rect, Color color)
        {
            GUI.color = color;
            GUI.DrawTexture(rect, Texture2D.whiteTexture);
            GUI.color = Color.white;
        }

        private void EnsureStyles()
        {
            if (titleStyle != null)
            {
                return;
            }

            titleStyle = new GUIStyle(GUI.skin.label)
            {
                fontSize = 15,
                fontStyle = FontStyle.Bold,
                normal = { textColor = new Color(0.92f, 0.96f, 1f) }
            };

            labelStyle = new GUIStyle(GUI.skin.label)
            {
                fontSize = 13,
                normal = { textColor = new Color(0.74f, 0.8f, 0.86f) }
            };

            valueStyle = new GUIStyle(GUI.skin.label)
            {
                fontSize = 20,
                fontStyle = FontStyle.Bold,
                alignment = TextAnchor.MiddleRight,
                normal = { textColor = Color.white }
            };

            menuTitleStyle = new GUIStyle(GUI.skin.label)
            {
                fontSize = 42,
                fontStyle = FontStyle.Bold,
                alignment = TextAnchor.MiddleCenter,
                normal = { textColor = Color.white }
            };

            menuTextStyle = new GUIStyle(GUI.skin.label)
            {
                fontSize = 16,
                alignment = TextAnchor.MiddleCenter,
                normal = { textColor = new Color(0.78f, 0.84f, 0.9f) }
            };
        }
    }
}
