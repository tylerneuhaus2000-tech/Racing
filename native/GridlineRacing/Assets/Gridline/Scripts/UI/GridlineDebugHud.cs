using UnityEngine;

namespace Gridline.Native
{
    public sealed class GridlineDebugHud : MonoBehaviour
    {
        public GridlineVehicleController Vehicle;
        public GridlineLapSystem LapSystem;
        public GridlineTimeTrialSession TimeTrial;
        public GridlineRaceSession Race;

        private GridlineInputRouter input;
        private GUIStyle titleStyle;
        private GUIStyle labelStyle;
        private GUIStyle mutedStyle;
        private GUIStyle valueStyle;
        private GUIStyle bigValueStyle;
        private GUIStyle menuTitleStyle;
        private GUIStyle menuTextStyle;
        private GUIStyle warningStyle;
        private GUIStyle goodStyle;
        private float fps;
        private Vector2 mapMin;
        private Vector2 mapMax;
        private bool mapBoundsReady;

        private string TrackTitle => LapSystem != null && LapSystem.Track != null
            ? LapSystem.Track.name.ToUpperInvariant()
            : "MONZA";

        private void Update()
        {
            if (input == null) input = GridlineInputRouter.Instance;
            float instantFps = Time.unscaledDeltaTime > 0.0001f ? 1f / Time.unscaledDeltaTime : 0f;
            fps = Mathf.Lerp(fps <= 0f ? instantFps : fps, instantFps, 0.06f);
        }

        private void OnGUI()
        {
            EnsureStyles();
            if (Vehicle == null) return;

            if (GridlineGameState.IsMenu)
            {
                DrawMenu();
                return;
            }

            DrawTopBar();
            DrawLapPanel();
            if (Race != null && Race.Enabled) DrawRaceStatus();
            DrawRaceDash();
            DrawGForcePanel();
            DrawTrackMap();
            if (TimeTrial != null && TimeTrial.IsManualCountdown)
                DrawCountdown(TimeTrial.CountdownText);
            else if (TimeTrial != null && TimeTrial.HasResult && (Race == null || !Race.Enabled))
                DrawTimeTrialResult();

            if (GridlineGameState.IsPaused) DrawPaused();
        }

        private void DrawTopBar()
        {
            float width = Mathf.Min(780f, Screen.width - 40f);
            Rect panel = new Rect(Screen.width * 0.5f - width * 0.5f, 18f, width, 42f);
            DrawPanel(panel, new Color(0.015f, 0.022f, 0.028f, 0.9f));

            GUI.Label(new Rect(panel.x + 18f, panel.y + 10f, 105f, 22f), $"{fps:000} FPS", goodStyle);
            GUI.Label(new Rect(panel.x + 140f, panel.y + 10f, 250f, 22f), TrackTitle, titleStyle);
            GUI.Label(new Rect(panel.x + 350f, panel.y + 10f, 130f, 22f),
                $"LAP {LapSystem?.CompletedLaps + 1 ?? 1}", labelStyle);
            GUI.Label(new Rect(panel.x + 480f, panel.y + 10f, 105f, 22f),
                TimeTrial?.ModeLabel ?? "TIME TRIAL", mutedStyle);
            GUI.Label(new Rect(panel.x + width - 165f, panel.y + 10f, 145f, 22f),
                $"{input?.ActiveInputSource ?? "NONE"}  ·  DRY", mutedStyle);
            if (LapSystem != null && LapSystem.IsWrongWay)
            {
                GUI.Label(new Rect(panel.x + width * 0.5f - 75f, panel.y + 10f, 150f, 22f),
                    "WRONG WAY", warningStyle);
            }
        }

        private void DrawLapPanel()
        {
            bool compact = Screen.width < 1200f || Input.touchSupported;
            float width = compact ? 280f : 330f;
            float height = compact ? 314f : 356f;
            float x = 22f;
            float y = compact ? 74f : Screen.height - height - 22f;
            Rect panel = new Rect(x, y, width, height);
            DrawPanel(panel, new Color(0.015f, 0.019f, 0.024f, 0.91f));
            DrawAccent(new Rect(panel.x, panel.y, 4f, panel.height), new Color(0.92f, 0.08f, 0.12f));

            GUI.Label(new Rect(panel.x + 18f, panel.y + 14f, 170f, 28f),
                $"LAP {LapSystem?.CompletedLaps + 1 ?? 1}", titleStyle);
            GUI.Label(new Rect(panel.x + width - 115f, panel.y + 16f, 95f, 22f),
                LapSystem != null && LapSystem.IsValidLap ? "VALID" : "INVALID",
                LapSystem != null && LapSystem.IsValidLap ? goodStyle : warningStyle);

            DrawKeyValue(panel, 52f, "CURRENT", FormatTime(LapSystem?.CurrentLapTime ?? 0f), valueStyle);
            DrawKeyValue(panel, 82f, "LAST", FormatTime(LapSystem?.LastLapTime ?? 0f), valueStyle);
            DrawKeyValue(panel, 112f, "BEST", FormatTime(LapSystem?.BestLapTime ?? 0f), goodStyle);
            DrawDivider(panel, 146f);
            DrawKeyValue(panel, 162f, "S1", FormatTime(LapSystem?.LastSectorTimes[0] ?? 0f), mutedStyle);
            DrawKeyValue(panel, 188f, "S2", FormatTime(LapSystem?.LastSectorTimes[1] ?? 0f), mutedStyle);
            DrawKeyValue(panel, 214f, "S3", FormatTime(LapSystem?.LastSectorTimes[2] ?? 0f), mutedStyle);
            DrawDivider(panel, 244f);

            float progress = LapSystem?.LapProgress ?? 0f;
            GUI.Label(new Rect(panel.x + 18f, panel.y + 256f, width - 36f, 20f),
                $"TRACK POSITION   {progress * 100f:0.0}%", mutedStyle);
            DrawBar(new Rect(panel.x + 18f, panel.y + 280f, width - 36f, 7f), progress,
                new Color(0.95f, 0.12f, 0.15f));
            GUI.Label(new Rect(panel.x + 18f, panel.y + 296f, width - 36f, 18f),
                $"NEXT CHECKPOINT   {LapSystem?.NextCheckpoint ?? 1}/{12}", mutedStyle);
        }

        private void DrawRaceDash()
        {
            float width = Mathf.Min(640f, Screen.width - 44f);
            float height = 166f;
            float x = Screen.width * 0.5f - width * 0.5f;
            float y = Screen.height - height - 24f;
            Rect panel = new Rect(x, y, width, height);
            DrawPanel(panel, new Color(0.01f, 0.015f, 0.02f, 0.94f));
            DrawAccent(new Rect(panel.x, panel.y, panel.width, 4f), new Color(0.92f, 0.08f, 0.12f));

            GUI.Label(new Rect(panel.x + 18f, panel.y + 15f, 110f, 18f), "F1 MODE", mutedStyle);
            Rect gearBox = new Rect(panel.x + 12f, panel.y + 34f, 112f, 78f);
            bool limiter = Vehicle.IsRevLimiter;
            float limiterPulse = limiter ? 0.32f + 0.42f * (0.5f + 0.5f * Mathf.Sin(Time.unscaledTime * 18f)) : 0f;
            DrawPanel(gearBox, limiter
                ? new Color(0.42f + limiterPulse, 0.015f, 0.02f, 0.96f)
                : new Color(0.02f, 0.03f, 0.04f, 0.96f));
            GUI.Label(new Rect(gearBox.x, gearBox.y + 2f, gearBox.width, 68f), Vehicle.GearLabel, bigValueStyle);
            GUI.Label(new Rect(gearBox.x, gearBox.y + 58f, gearBox.width, 16f), limiter ? "LIMITER" : "GEAR", limiter ? warningStyle : mutedStyle);
            GUI.Label(new Rect(panel.x + 136f, panel.y + 58f, 170f, 36f),
                $"{Vehicle.SpeedKph:000} KM/H", valueStyle);
            GUI.Label(new Rect(panel.x + 136f, panel.y + 96f, 170f, 18f),
                $"RPM {Vehicle.Rpm:00000}", mutedStyle);

            float barX = panel.x + 320f;
            float barW = panel.width - 340f;
            DrawBar(new Rect(barX, panel.y + 30f, barW, 10f), Vehicle.ThrottleInput,
                new Color(0.12f, 0.86f, 0.38f));
            GUI.Label(new Rect(barX, panel.y + 12f, barW, 18f), "THROTTLE", mutedStyle);
            DrawBar(new Rect(barX, panel.y + 63f, barW, 10f), Vehicle.BrakeInput,
                new Color(0.95f, 0.10f, 0.12f));
            GUI.Label(new Rect(barX, panel.y + 45f, barW, 18f), "BRAKE", mutedStyle);
            DrawSignedBar(new Rect(barX, panel.y + 96f, barW, 10f), Vehicle.SteerInput,
                new Color(0.20f, 0.60f, 1f));
            GUI.Label(new Rect(barX, panel.y + 78f, barW, 18f), "STEERING", mutedStyle);

            DrawSmallStat(new Rect(panel.x + 18f, panel.y + 128f, 130f, 26f), "LAP", $"{LapSystem?.LapProgress * 100f ?? 0f:0}%");
            DrawSmallStat(new Rect(panel.x + 158f, panel.y + 128f, 130f, 26f), "SURFACE", Vehicle.SurfaceLabel);
            DrawSmallStat(new Rect(panel.x + 298f, panel.y + 128f, 130f, 26f), "TYRE", Vehicle.TireLabel);
        }

        private void DrawRaceStatus()
        {
            bool compact = Screen.width < 1200f || Input.touchSupported;
            float width = 236f;
            float height = 92f;
            float x = Screen.width - width - 22f;
            float y = compact ? 488f : 84f;
            Rect panel = new Rect(x, y, width, height);
            DrawPanel(panel, new Color(0.015f, 0.019f, 0.024f, 0.91f));
            DrawAccent(new Rect(panel.x, panel.y, 4f, panel.height), new Color(0.95f, 0.12f, 0.15f));
            GUI.Label(new Rect(panel.x + 16f, panel.y + 12f, 90f, 20f), "RACE", titleStyle);
            GUI.Label(new Rect(panel.x + 112f, panel.y + 14f, 104f, 18f),
                Race.Phase.ToString().ToUpperInvariant(), Race.Phase == GridlineRacePhase.Live ? goodStyle : mutedStyle);
            GUI.Label(new Rect(panel.x + 16f, panel.y + 46f, 98f, 20f),
                $"P {Race.PlayerPosition}/{Race.ParticipantCount}", valueStyle);
            GUI.Label(new Rect(panel.x + 120f, panel.y + 48f, 96f, 18f),
                $"GAP {Race.GapToLeaderMeters:0.0} M", mutedStyle);
        }

        private void DrawTrackMap()
        {
            if (LapSystem == null || LapSystem.Track == null || LapSystem.Track.points == null || LapSystem.Track.points.Length < 4)
                return;

            bool compact = Screen.width < 1200f || Input.touchSupported;
            float width = compact ? 250f : 280f;
            float height = compact ? 188f : 208f;
            float x = Screen.width - width - 22f;
            float y = compact ? 286f : 84f;
            Rect panel = new Rect(x, y, width, height);
            DrawPanel(panel, new Color(0.015f, 0.019f, 0.024f, 0.91f));
            DrawAccent(new Rect(panel.x, panel.y, 4f, panel.height), new Color(0.95f, 0.12f, 0.15f));
            GUI.Label(new Rect(panel.x + 18f, panel.y + 12f, width - 36f, 20f), TrackTitle, titleStyle);
            GUI.Label(new Rect(panel.x + width - 88f, panel.y + 14f, 70f, 18f), "TRACK MAP", mutedStyle);

            EnsureMapBounds();
            Rect map = new Rect(panel.x + 18f, panel.y + 42f, width - 36f, height - 58f);
            DrawPanel(map, new Color(0.02f, 0.03f, 0.04f, 0.82f));
            for (int i = 0; i < LapSystem.Track.points.Length; i += 1)
            {
                Vector2 a = MapPoint(LapSystem.Track.Point(i), map);
                Vector2 b = MapPoint(LapSystem.Track.Point(i + 1), map);
                DrawLine(a, b, new Color(0.42f, 0.48f, 0.55f, 0.9f), 2f);
            }

            Vector2 start = MapPoint(LapSystem.Track.Point(0), map);
            DrawPanel(new Rect(start.x - 3f, start.y - 3f, 6f, 6f), Color.white);
            int playerIndex = Mathf.Clamp(
                Mathf.RoundToInt(Vehicle.TrackProgress * (LapSystem.Track.points.Length - 1)),
                0,
                LapSystem.Track.points.Length - 1);
            Vector2 player = MapPoint(LapSystem.Track.Point(playerIndex), map);
            DrawPanel(new Rect(player.x - 5f, player.y - 5f, 10f, 10f), new Color(1f, 0.10f, 0.12f));
        }

        private void EnsureMapBounds()
        {
            if (mapBoundsReady || LapSystem == null || LapSystem.Track == null) return;
            Vector3 first = LapSystem.Track.Point(0);
            mapMin = new Vector2(first.x, first.z);
            mapMax = mapMin;
            for (int i = 1; i < LapSystem.Track.points.Length; i += 1)
            {
                Vector3 point = LapSystem.Track.Point(i);
                mapMin = Vector2.Min(mapMin, new Vector2(point.x, point.z));
                mapMax = Vector2.Max(mapMax, new Vector2(point.x, point.z));
            }
            mapBoundsReady = true;
        }

        private Vector2 MapPoint(Vector3 point, Rect map)
        {
            Vector2 range = mapMax - mapMin;
            float padding = 12f;
            float usableWidth = Mathf.Max(1f, map.width - padding * 2f);
            float usableHeight = Mathf.Max(1f, map.height - padding * 2f);
            float scale = Mathf.Min(usableWidth / Mathf.Max(range.x, 1f), usableHeight / Mathf.Max(range.y, 1f));
            Vector2 size = range * scale;
            Vector2 origin = new Vector2(map.x + (map.width - size.x) * 0.5f, map.y + (map.height - size.y) * 0.5f);
            return origin + new Vector2((point.x - mapMin.x) * scale, (mapMax.y - point.z) * scale);
        }

        private static void DrawLine(Vector2 from, Vector2 to, Color color, float thickness)
        {
            Matrix4x4 oldMatrix = GUI.matrix;
            Color oldColor = GUI.color;
            Vector2 delta = to - from;
            float length = delta.magnitude;
            if (length > 0.01f)
            {
                float angle = Mathf.Atan2(delta.y, delta.x) * Mathf.Rad2Deg;
                GUIUtility.RotateAroundPivot(angle, from);
                GUI.color = color;
                GUI.DrawTexture(new Rect(from.x, from.y - thickness * 0.5f, length, thickness), Texture2D.whiteTexture);
            }
            GUI.matrix = oldMatrix;
            GUI.color = oldColor;
        }

        private void DrawGForcePanel()
        {
            bool compact = Screen.width < 1200f || Input.touchSupported;
            float width = compact ? 250f : 280f;
            float height = 196f;
            float x = Screen.width - width - 22f;
            float y = compact ? 74f : Screen.height - height - 22f;
            Rect panel = new Rect(x, y, width, height);
            DrawPanel(panel, new Color(0.015f, 0.019f, 0.024f, 0.91f));
            DrawAccent(new Rect(panel.x, panel.y, 4f, panel.height), new Color(0.18f, 0.58f, 1f));
            GUI.Label(new Rect(panel.x + 18f, panel.y + 14f, 150f, 20f), "G-FORCE", titleStyle);

            Rect cross = new Rect(panel.x + 24f, panel.y + 48f, 108f, 108f);
            DrawPanel(cross, new Color(0.04f, 0.06f, 0.08f, 0.9f));
            GUI.Label(new Rect(cross.x + 39f, cross.y + 40f, 35f, 24f), "+", mutedStyle);
            float dotX = cross.x + 54f + Mathf.Clamp(Vehicle.LateralG, -1.5f, 1.5f) * 26f;
            float dotY = cross.y + 54f - Mathf.Clamp(Vehicle.LongitudinalG, -1.5f, 1.5f) * 26f;
            DrawPanel(new Rect(dotX - 7f, dotY - 7f, 14f, 14f), new Color(0.10f, 0.95f, 0.42f));
            GUI.Label(new Rect(panel.x + 150f, panel.y + 53f, 110f, 24f),
                $"{Vehicle.LateralG:+0.00;-0.00;0.00} g", valueStyle);
            GUI.Label(new Rect(panel.x + 150f, panel.y + 86f, 110f, 24f),
                $"{Vehicle.LongitudinalG:+0.00;-0.00;0.00} g", valueStyle);
            GUI.Label(new Rect(panel.x + 150f, panel.y + 119f, 110f, 20f), "LAT / LONG", mutedStyle);
            GUI.Label(new Rect(panel.x + 18f, panel.y + 166f, width - 36f, 20f),
                $"SLIP ANGLE   {Vehicle.SlipAngle * Mathf.Rad2Deg:0.0}°", mutedStyle);
        }

        private void DrawSmallStat(Rect rect, string key, string value)
        {
            DrawPanel(rect, new Color(1f, 1f, 1f, 0.06f));
            GUI.Label(new Rect(rect.x + 8f, rect.y + 4f, 48f, 18f), key, mutedStyle);
            GUI.Label(new Rect(rect.x + 55f, rect.y + 4f, rect.width - 62f, 18f), value, labelStyle);
        }

        private void DrawKeyValue(Rect panel, float offsetY, string key, string value, GUIStyle valueType)
        {
            GUI.Label(new Rect(panel.x + 18f, panel.y + offsetY, 90f, 22f), key, mutedStyle);
            GUI.Label(new Rect(panel.x + panel.width - 160f, panel.y + offsetY, 142f, 22f), value, valueType);
        }

        private static void DrawDivider(Rect panel, float offsetY)
        {
            GUI.color = new Color(1f, 1f, 1f, 0.12f);
            GUI.DrawTexture(new Rect(panel.x + 18f, panel.y + offsetY, panel.width - 36f, 1f), Texture2D.whiteTexture);
            GUI.color = Color.white;
        }

        private static void DrawAccent(Rect rect, Color color)
        {
            GUI.color = color;
            GUI.DrawTexture(rect, Texture2D.whiteTexture);
            GUI.color = Color.white;
        }

        private static void DrawPanel(Rect rect, Color color)
        {
            GUI.color = color;
            GUI.DrawTexture(rect, Texture2D.whiteTexture);
            GUI.color = Color.white;
        }

        private static void DrawBar(Rect rect, float value, Color fillColor)
        {
            DrawPanel(rect, new Color(1f, 1f, 1f, 0.12f));
            GUI.color = fillColor;
            GUI.DrawTexture(new Rect(rect.x, rect.y, rect.width * Mathf.Clamp01(value), rect.height), Texture2D.whiteTexture);
            GUI.color = Color.white;
        }

        private static void DrawSignedBar(Rect rect, float value, Color fillColor)
        {
            DrawPanel(rect, new Color(1f, 1f, 1f, 0.12f));
            float center = rect.x + rect.width * 0.5f;
            float width = rect.width * 0.5f * Mathf.Abs(Mathf.Clamp(value, -1f, 1f));
            GUI.color = fillColor;
            GUI.DrawTexture(value >= 0f
                ? new Rect(center, rect.y, width, rect.height)
                : new Rect(center - width, rect.y, width, rect.height), Texture2D.whiteTexture);
            GUI.color = Color.white;
        }

        private void DrawMenu()
        {
            Rect panel = new Rect(Screen.width * 0.5f - 260f, Screen.height * 0.5f - 145f, 520f, 290f);
            DrawPanel(panel, new Color(0.01f, 0.012f, 0.016f, 0.94f));
            DrawAccent(new Rect(panel.x, panel.y, panel.width, 4f), new Color(0.92f, 0.08f, 0.12f));
            GUI.Label(new Rect(panel.x + 30f, panel.y + 30f, panel.width - 60f, 56f), "GRIDLINE", menuTitleStyle);
            GUI.Label(new Rect(panel.x + 32f, panel.y + 92f, panel.width - 64f, 30f),
                $"{TimeTrial?.ModeLabel ?? "TIME TRIAL"}  ·  {TrackTitle}  ·  FERRARI 296 GT3", menuTextStyle);
            string startLabel = Race != null && Race.Enabled
                ? "Tap / A / Enter: start race"
                : "Tap / A / Enter: start time trial";
            GUI.Label(new Rect(panel.x + 32f, panel.y + 142f, panel.width - 64f, 26f), startLabel, menuTextStyle);
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

        private void DrawCountdown(string text)
        {
            float width = Mathf.Min(360f, Screen.width - 40f);
            float x = Screen.width * 0.5f - width * 0.5f;
            float y = Screen.height * 0.5f - 88f;
            DrawPanel(new Rect(x, y, width, 176f), new Color(0.01f, 0.015f, 0.02f, 0.88f));
            GUI.Label(new Rect(x, y + 18f, width, 24f), "TIME TRIAL", mutedStyle);
            GUI.Label(new Rect(x, y + 48f, width, 88f), text, bigValueStyle);
            GUI.Label(new Rect(x, y + 140f, width, 20f), "HOLD POSITION", mutedStyle);
        }

        private void DrawTimeTrialResult()
        {
            bool valid = LapSystem != null && LapSystem.LastLapWasValid;
            float width = Mathf.Min(430f, Screen.width - 40f);
            float height = valid ? 112f : 132f;
            float x = Screen.width * 0.5f - width * 0.5f;
            float y = 72f;
            DrawPanel(new Rect(x, y, width, height), new Color(0.01f, 0.015f, 0.02f, 0.94f));
            DrawAccent(new Rect(x, y, width, 4f), valid
                ? new Color(0.10f, 0.90f, 0.42f)
                : new Color(0.95f, 0.12f, 0.15f));
            GUI.Label(new Rect(x + 18f, y + 14f, width - 36f, 20f),
                valid ? "TIME TRIAL · LAP COMPLETE" : "TIME TRIAL · LAP INVALID",
                valid ? goodStyle : warningStyle);
            DrawSmallStat(new Rect(x + 18f, y + 42f, (width - 54f) * 0.5f, 28f),
                "LAST", FormatTime(LapSystem?.LastLapTime ?? 0f));
            DrawSmallStat(new Rect(x + 27f + (width - 54f) * 0.5f, y + 42f,
                (width - 54f) * 0.5f, 28f), "BEST", FormatTime(LapSystem?.BestLapTime ?? 0f));
            if (valid)
            {
                GUI.Label(new Rect(x + 18f, y + 82f, width - 36f, 18f),
                    "R: RESTART   ·   ESC: MENU", mutedStyle);
            }
            else
            {
                GUI.Label(new Rect(x + 18f, y + 82f, width - 36f, 18f),
                    $"REASON   {LapSystem?.LastCompletedLapInvalidReason ?? "unknown"}", warningStyle);
                GUI.Label(new Rect(x + 18f, y + 104f, width - 36f, 18f),
                    "R: RESTART   ·   ESC: MENU", mutedStyle);
            }
        }

        private static string FormatTime(float seconds)
        {
            if (seconds <= 0f) return "--:--.---";
            int minutes = Mathf.FloorToInt(seconds / 60f);
            float remainder = seconds - minutes * 60f;
            return $"{minutes:00}:{remainder:00.000}";
        }

        private void EnsureStyles()
        {
            if (titleStyle != null) return;

            titleStyle = new GUIStyle(GUI.skin.label)
            {
                fontSize = 15,
                fontStyle = FontStyle.Bold,
                normal = { textColor = new Color(0.92f, 0.96f, 1f) }
            };
            labelStyle = new GUIStyle(GUI.skin.label)
            {
                fontSize = 13,
                normal = { textColor = new Color(0.78f, 0.84f, 0.9f) }
            };
            mutedStyle = new GUIStyle(GUI.skin.label)
            {
                fontSize = 11,
                normal = { textColor = new Color(0.50f, 0.58f, 0.66f) }
            };
            valueStyle = new GUIStyle(GUI.skin.label)
            {
                fontSize = 19,
                fontStyle = FontStyle.Bold,
                alignment = TextAnchor.MiddleRight,
                normal = { textColor = Color.white }
            };
            bigValueStyle = new GUIStyle(GUI.skin.label)
            {
                fontSize = 54,
                fontStyle = FontStyle.Bold,
                alignment = TextAnchor.MiddleCenter,
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
            warningStyle = new GUIStyle(labelStyle)
            {
                fontStyle = FontStyle.Bold,
                alignment = TextAnchor.MiddleRight,
                normal = { textColor = new Color(1f, 0.32f, 0.22f) }
            };
            goodStyle = new GUIStyle(labelStyle)
            {
                fontStyle = FontStyle.Bold,
                alignment = TextAnchor.MiddleRight,
                normal = { textColor = new Color(0.12f, 0.95f, 0.42f) }
            };
        }
    }
}
