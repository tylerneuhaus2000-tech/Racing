using UnityEngine;

namespace Gridline.Native
{
    public sealed class GridlineTouchControls : MonoBehaviour
    {
        private const string PositionKey = "Gridline.TouchControl.";
        private readonly Vector2[] controlPositions =
        {
            new Vector2(0.04f, 0.68f),
            new Vector2(0.78f, 0.52f),
            new Vector2(0.78f, 0.76f),
            new Vector2(0.59f, 0.78f)
        };
        private readonly Vector2[] controlSizes =
        {
            new Vector2(0.36f, 0.25f),
            new Vector2(0.17f, 0.22f),
            new Vector2(0.17f, 0.15f),
            new Vector2(0.14f, 0.13f)
        };
        private GUIStyle controlStyle;
        private GUIStyle buttonStyle;
        private bool positionsLoaded;
        private bool layoutMode;
        private int draggingControl = -1;
        private Vector2 dragOffset;

        private void Update()
        {
            if (!Input.touchSupported)
            {
                return;
            }

            LoadPositions();
            if (HandleLayoutTouches()) return;

            if (GridlineGameState.IsMenu)
            {
                for (int i = 0; i < Input.touchCount; i += 1)
                {
                    Touch touch = Input.GetTouch(i);
                    if (touch.phase == TouchPhase.Began)
                    {
                        GridlineGameState.StartDriving();
                        return;
                    }
                }

                return;
            }

            if (!GridlineGameState.IsDriving || GridlineInputRouter.Instance == null)
            {
                return;
            }

            float throttle = 0f;
            float brake = 0f;
            float steering = 0f;
            float handbrake = 0f;
            bool hasControlTouch = false;

            for (int i = 0; i < Input.touchCount; i += 1)
            {
                Touch touch = Input.GetTouch(i);
                if (touch.phase == TouchPhase.Ended || touch.phase == TouchPhase.Canceled)
                {
                    continue;
                }

                Vector2 position = new Vector2(touch.position.x, Screen.height - touch.position.y);
                if (GetSteeringRect().Contains(position))
                {
                    hasControlTouch = true;
                    Rect steeringRect = GetSteeringRect();
                    float center = steeringRect.center.x;
                    float radius = steeringRect.width * 0.5f;
                    steering = Mathf.Clamp((position.x - center) / radius, -1f, 1f);
                }
                else if (GetThrottleRect().Contains(position))
                {
                    hasControlTouch = true;
                    throttle = 1f;
                }
                else if (GetBrakeRect().Contains(position))
                {
                    hasControlTouch = true;
                    brake = 1f;
                }
                else if (GetHandbrakeRect().Contains(position))
                {
                    hasControlTouch = true;
                    handbrake = 1f;
                }
            }

            if (hasControlTouch)
            {
                GridlineInputRouter.Instance.SetTouchInput(throttle, brake, steering, handbrake);
            }
        }

        private void OnGUI()
        {
            if (!Input.touchSupported)
            {
                return;
            }

            EnsureStyle();
            if (GridlineGameState.IsMenu)
            {
                Rect start = new Rect(Screen.width * 0.5f - 150f, Screen.height * 0.5f + 92f, 300f, 54f);
                Color previous = GUI.color;
                GUI.color = new Color(0.88f, 0.08f, 0.11f, 0.95f);
                if (GUI.Button(start, "TAP TO DRIVE", controlStyle)) GridlineGameState.StartDriving();
                GUI.color = previous;
                return;
            }

            if (!GridlineGameState.IsDriving)
            {
                return;
            }

            LoadPositions();
            DrawControl(GetSteeringRect(), "STEER");
            DrawControl(GetThrottleRect(), "GAS");
            DrawControl(GetBrakeRect(), "BRAKE");
            DrawControl(GetHandbrakeRect(), "HANDBRAKE");
            Rect layoutButton = GetLayoutButtonRect();
            GUI.color = layoutMode ? new Color(0.92f, 0.08f, 0.11f, 0.95f)
                : new Color(0.04f, 0.07f, 0.1f, 0.82f);
            if (GUI.Button(layoutButton, layoutMode ? "DONE" : "LAYOUT", buttonStyle))
            {
                if (layoutMode) SaveAndExitLayout();
                else layoutMode = true;
            }
            GUI.color = Color.white;
            if (layoutMode)
            {
                GUI.Label(new Rect(layoutButton.x, layoutButton.y + layoutButton.height + 5f,
                    180f, 22f), "DRAG CONTROLS", controlStyle);
            }
        }

        private void DrawControl(Rect rect, string label)
        {
            GUI.color = layoutMode
                ? new Color(0.10f, 0.48f, 0.75f, 0.68f)
                : new Color(0.04f, 0.07f, 0.1f, 0.4f);
            GUI.DrawTexture(rect, Texture2D.whiteTexture);
            GUI.color = Color.white;
            GUI.Label(rect, label, controlStyle);
        }

        private Rect GetSteeringRect()
        {
            return GetControlRect(0);
        }

        private Rect GetThrottleRect()
        {
            return GetControlRect(1);
        }

        private Rect GetBrakeRect()
        {
            return GetControlRect(2);
        }

        private Rect GetHandbrakeRect()
        {
            return GetControlRect(3);
        }

        private Rect GetControlRect(int index)
        {
            Vector2 position = controlPositions[index];
            Vector2 size = controlSizes[index];
            return new Rect(Screen.width * position.x, Screen.height * position.y,
                Screen.width * size.x, Screen.height * size.y);
        }

        private Rect GetLayoutButtonRect()
        {
            return new Rect(Screen.width * 0.04f, Screen.height * 0.04f, 92f, 34f);
        }

        private bool HandleLayoutTouches()
        {
            if (GridlineGameState.IsMenu) return false;
            Rect layoutButton = GetLayoutButtonRect();
            for (int i = 0; i < Input.touchCount; i += 1)
            {
                Touch touch = Input.GetTouch(i);
                Vector2 position = new Vector2(touch.position.x, Screen.height - touch.position.y);
                if (touch.phase == TouchPhase.Began && !layoutMode && layoutButton.Contains(position))
                {
                    layoutMode = true;
                    return true;
                }
            }

            if (!layoutMode) return false;
            if (GridlineInputRouter.Instance != null)
                GridlineInputRouter.Instance.SetTouchInput(0f, 0f, 0f, 0f);

            Rect doneButton = layoutButton;
            for (int i = 0; i < Input.touchCount; i += 1)
            {
                Touch touch = Input.GetTouch(i);
                Vector2 position = new Vector2(touch.position.x, Screen.height - touch.position.y);
                if (touch.phase == TouchPhase.Began)
                {
                    if (doneButton.Contains(position))
                    {
                        SaveAndExitLayout();
                        return true;
                    }

                    for (int control = 0; control < controlPositions.Length; control += 1)
                    {
                        if (!GetControlRect(control).Contains(position)) continue;
                        draggingControl = control;
                        Rect rect = GetControlRect(control);
                        dragOffset = position - new Vector2(rect.x, rect.y);
                        break;
                    }
                }
                else if ((touch.phase == TouchPhase.Moved || touch.phase == TouchPhase.Stationary)
                    && draggingControl >= 0)
                {
                    Vector2 size = controlSizes[draggingControl];
                    float x = (position.x - dragOffset.x) / Mathf.Max(Screen.width, 1f);
                    float y = (position.y - dragOffset.y) / Mathf.Max(Screen.height, 1f);
                    controlPositions[draggingControl] = new Vector2(
                        Mathf.Clamp(x, 0f, 1f - size.x),
                        Mathf.Clamp(y, 0f, 1f - size.y));
                }
                else if ((touch.phase == TouchPhase.Ended || touch.phase == TouchPhase.Canceled)
                    && draggingControl >= 0)
                {
                    draggingControl = -1;
                }
            }
            return true;
        }

        private void LoadPositions()
        {
            if (positionsLoaded) return;
            positionsLoaded = true;
            for (int i = 0; i < controlPositions.Length; i += 1)
            {
                string key = PositionKey + i + ".";
                if (!PlayerPrefs.HasKey(key + "x")) continue;
                controlPositions[i] = new Vector2(
                    PlayerPrefs.GetFloat(key + "x", controlPositions[i].x),
                    PlayerPrefs.GetFloat(key + "y", controlPositions[i].y));
            }
        }

        private void SaveAndExitLayout()
        {
            for (int i = 0; i < controlPositions.Length; i += 1)
            {
                string key = PositionKey + i + ".";
                PlayerPrefs.SetFloat(key + "x", controlPositions[i].x);
                PlayerPrefs.SetFloat(key + "y", controlPositions[i].y);
            }
            PlayerPrefs.Save();
            draggingControl = -1;
            layoutMode = false;
        }

        private void EnsureStyle()
        {
            if (controlStyle != null)
            {
                return;
            }

            controlStyle = new GUIStyle(GUI.skin.label)
            {
                alignment = TextAnchor.MiddleCenter,
                fontSize = 14,
                fontStyle = FontStyle.Bold
            };
            buttonStyle = new GUIStyle(GUI.skin.button)
            {
                alignment = TextAnchor.MiddleCenter,
                fontSize = 12,
                fontStyle = FontStyle.Bold
            };
        }
    }
}
