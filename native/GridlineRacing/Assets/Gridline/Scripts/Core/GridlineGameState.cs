using UnityEngine;

namespace Gridline.Native
{
    public enum GridlineSessionState
    {
        Menu,
        Driving,
        Paused
    }

    public static class GridlineGameState
    {
        public static GridlineSessionState SessionState { get; private set; } = GridlineSessionState.Menu;

        public static bool IsDriving => SessionState == GridlineSessionState.Driving;
        public static bool IsMenu => SessionState == GridlineSessionState.Menu;
        public static bool IsPaused => SessionState == GridlineSessionState.Paused;

        public static void StartDriving()
        {
            SessionState = GridlineSessionState.Driving;
            Time.timeScale = 1f;
            Cursor.visible = false;
            Cursor.lockState = CursorLockMode.Locked;
        }

        public static void ReturnToMenu()
        {
            SessionState = GridlineSessionState.Menu;
            Time.timeScale = 1f;
            Cursor.visible = true;
            Cursor.lockState = CursorLockMode.None;
        }

        public static void TogglePause()
        {
            if (SessionState == GridlineSessionState.Menu)
            {
                return;
            }

            if (SessionState == GridlineSessionState.Paused)
            {
                StartDriving();
                return;
            }

            SessionState = GridlineSessionState.Paused;
            Time.timeScale = 0f;
            Cursor.visible = true;
            Cursor.lockState = CursorLockMode.None;
        }
    }
}
