using System;
using UnityEngine;

namespace Gridline.Native
{
    // Native time-trial session state. Timing and validity still come from the
    // production lap system; this component only owns the session/result flow.
    [DefaultExecutionOrder(-10)]
    public sealed class GridlineTimeTrialSession : MonoBehaviour
    {
        public GridlineLapSystem LapSystem;
        public GridlineVehicleController Vehicle;
        public string ModeLabel => GridlineRuntimeBuilder.Race != null
            && GridlineRuntimeBuilder.Race.Enabled ? "RACE" : "TIME TRIAL";
        public bool HasStarted { get; private set; }
        public bool HasResult { get; private set; }
        public int SessionNumber { get; private set; }
        public bool IsManualCountdown { get; private set; }
        public string CountdownText { get; private set; } = string.Empty;

        private int observedCompletedLaps;
        private int observedResetCount;
        private bool active;
        private bool qaMode;
        private bool restartQa;
        private bool restartQaTriggered;
        private float restartQaElapsed;
        private bool qaCompleted;
        private float countdownElapsed;
        private int lastCountdownNumber;

        public void Configure(GridlineVehicleController vehicle, GridlineLapSystem lapSystem)
        {
            Vehicle = vehicle;
            LapSystem = lapSystem;
            active = !HasArgument("-gridline-disable-time-trial")
                && !HasArgument("-gridline-race")
                && !HasArgument("-gridline-qa-race");
            qaMode = HasArgument("-gridline-qa-time-trial");
            restartQa = HasArgument("-gridline-qa-time-trial-restart");
            observedCompletedLaps = lapSystem != null ? lapSystem.CompletedLaps : 0;
            observedResetCount = vehicle != null ? vehicle.ResetCount : 0;
        }

        private void Update()
        {
            if (!active || LapSystem == null || Vehicle == null) return;

            if (GridlineGameState.IsDriving && !HasStarted)
            {
                HasStarted = true;
                SessionNumber += 1;
                Debug.Log($"Gridline time trial started session={SessionNumber} "
                    + $"track={LapSystem.Track?.name ?? "unknown"} vehicle=Ferrari 296 GT3");
                if (!HasAutomatedQaArgument())
                {
                    IsManualCountdown = true;
                    countdownElapsed = 0f;
                    lastCountdownNumber = 3;
                    CountdownText = "3";
                    Debug.Log("Gridline time trial countdown 3");
                }
            }

            if (!GridlineGameState.IsDriving) return;

            if (IsManualCountdown)
            {
                countdownElapsed += Mathf.Clamp(Time.unscaledDeltaTime, 0f, 0.25f);
                int remaining = Mathf.CeilToInt(3f - countdownElapsed);
                if (remaining > 0 && remaining < lastCountdownNumber)
                {
                    lastCountdownNumber = remaining;
                    CountdownText = remaining.ToString();
                    Debug.Log($"Gridline time trial countdown {remaining}");
                }

                if (countdownElapsed < 3f) return;
                IsManualCountdown = false;
                CountdownText = "GO";
                Debug.Log("Gridline time trial GREEN");
            }

            if (Vehicle.ResetCount != observedResetCount)
            {
                observedResetCount = Vehicle.ResetCount;
                observedCompletedLaps = LapSystem.CompletedLaps;
                LapSystem.RestartCurrentLap();
                HasResult = false;
                Debug.Log($"Gridline time trial restarted session={SessionNumber} "
                    + "reason=vehicle_reset");
                if (restartQa && restartQaTriggered)
                {
                    Debug.Log($"Gridline time trial restart QA PASS session={SessionNumber} "
                        + $"resetCount={Vehicle.ResetCount}");
                    Application.Quit(0);
                    return;
                }
            }

            if (restartQa && !restartQaTriggered)
            {
                restartQaElapsed += Time.unscaledDeltaTime;
                if (restartQaElapsed >= 5f)
                {
                    restartQaTriggered = true;
                    Debug.Log("Gridline time trial restart QA reset requested");
                    Vehicle.ResetCar();
                    return;
                }
            }

            if (LapSystem.CompletedLaps < observedCompletedLaps)
            {
                observedCompletedLaps = LapSystem.CompletedLaps;
                HasResult = false;
                Debug.Log($"Gridline time trial restarted session={SessionNumber} "
                    + "reason=vehicle_reset");
            }

            if (LapSystem.CompletedLaps == observedCompletedLaps) return;
            observedCompletedLaps = LapSystem.CompletedLaps;
            HasResult = true;

            Debug.Log($"Gridline time trial result lap={LapSystem.CompletedLaps} "
                + $"time={LapSystem.LastLapTime:0.000}s valid={LapSystem.LastLapWasValid} "
                + $"rule={(LapSystem.LastLapWasValid ? "none" : LapSystem.LastCompletedLapInvalidReason)} "
                + $"best={LapSystem.BestLapTime:0.000}s "
                + $"validCount={LapSystem.ValidCompletedLaps} "
                + $"invalidCount={LapSystem.InvalidCompletedLaps}");

            if (qaMode && !qaCompleted && LapSystem.ValidCompletedLaps >= 1)
            {
                qaCompleted = true;
                Debug.Log($"Gridline time trial QA PASS validCount={LapSystem.ValidCompletedLaps} "
                    + $"last={LapSystem.LastLapTime:0.000}s best={LapSystem.BestLapTime:0.000}s");
                Application.Quit(0);
            }
        }

        private static bool HasAutomatedQaArgument()
        {
            string[] automatedArguments =
            {
                "-gridline-qa-vehicle",
                "-gridline-qa-tyre-interaction",
                "-gridline-qa-lap",
                "-gridline-qa-time-trial",
                "-gridline-qa-time-trial-restart",
                "-gridline-qa-race",
                "-gridline-qa-rules",
                "-gridline-qa-grass",
                "-gridline-qa-surfaces",
                "-gridline-qa-track-sweep",
                "-gridline-qa-spawn"
            };
            string[] args = Environment.GetCommandLineArgs();
            for (int i = 0; i < args.Length; i += 1)
            {
                for (int j = 0; j < automatedArguments.Length; j += 1)
                {
                    if (args[i].Equals(automatedArguments[j], StringComparison.OrdinalIgnoreCase))
                        return true;
                }
            }
            return false;
        }

        private static bool HasArgument(string expected)
        {
            string[] args = Environment.GetCommandLineArgs();
            for (int i = 0; i < args.Length; i += 1)
                if (args[i].Equals(expected, StringComparison.OrdinalIgnoreCase)) return true;
            return false;
        }
    }
}
