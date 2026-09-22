using UnityEngine;

namespace Gridline.Native
{
    public sealed class GridlineTouchControls : MonoBehaviour
    {
        private GUIStyle controlStyle;

        private void Update()
        {
            if (!GridlineGameState.IsDriving || GridlineInputRouter.Instance == null)
            {
                return;
            }

            float throttle = 0f;
            float brake = 0f;
            float steering = 0f;
            float handbrake = 0f;
            bool hasTouch = false;

            for (int i = 0; i < Input.touchCount; i += 1)
            {
                Touch touch = Input.GetTouch(i);
                if (touch.phase == TouchPhase.Ended || touch.phase == TouchPhase.Canceled)
                {
                    continue;
                }

                hasTouch = true;
                Vector2 position = new Vector2(touch.position.x, Screen.height - touch.position.y);
                if (GetSteeringRect().Contains(position))
                {
                    float center = Screen.width * 0.22f;
                    float radius = Screen.width * 0.18f;
                    steering = Mathf.Clamp((position.x - center) / radius, -1f, 1f);
                }
                else if (GetThrottleRect().Contains(position))
                {
                    throttle = 1f;
                }
                else if (GetBrakeRect().Contains(position))
                {
                    brake = 1f;
                }
                else if (GetHandbrakeRect().Contains(position))
                {
                    handbrake = 1f;
                }
            }

            if (hasTouch)
            {
                GridlineInputRouter.Instance.SetTouchInput(throttle, brake, steering, handbrake);
            }
        }

        private void OnGUI()
        {
            if (!GridlineGameState.IsDriving || !Input.touchSupported)
            {
                return;
            }

            EnsureStyle();
            DrawControl(GetSteeringRect(), "STEER");
            DrawControl(GetThrottleRect(), "GAS");
            DrawControl(GetBrakeRect(), "BRAKE");
            DrawControl(GetHandbrakeRect(), "HANDBRAKE");
        }

        private void DrawControl(Rect rect, string label)
        {
            GUI.color = new Color(0.04f, 0.07f, 0.1f, 0.4f);
            GUI.DrawTexture(rect, Texture2D.whiteTexture);
            GUI.color = Color.white;
            GUI.Label(rect, label, controlStyle);
        }

        private Rect GetSteeringRect()
        {
            return new Rect(Screen.width * 0.04f, Screen.height * 0.68f, Screen.width * 0.36f, Screen.height * 0.25f);
        }

        private Rect GetThrottleRect()
        {
            return new Rect(Screen.width * 0.78f, Screen.height * 0.52f, Screen.width * 0.17f, Screen.height * 0.22f);
        }

        private Rect GetBrakeRect()
        {
            return new Rect(Screen.width * 0.78f, Screen.height * 0.76f, Screen.width * 0.17f, Screen.height * 0.15f);
        }

        private Rect GetHandbrakeRect()
        {
            return new Rect(Screen.width * 0.59f, Screen.height * 0.78f, Screen.width * 0.14f, Screen.height * 0.13f);
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
        }
    }
}
