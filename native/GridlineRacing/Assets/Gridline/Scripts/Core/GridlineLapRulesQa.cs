using System;
using UnityEngine;

namespace Gridline.Native
{
    // Runtime probes for lap rules. These scenarios intentionally create a
    // wrong-way and an off-track state, then verify the real lap system's
    // classification and reset behavior without changing production rules.
    public sealed class GridlineLapRulesQa : MonoBehaviour
    {
        private enum Phase
        {
            Idle,
            WrongWay,
            TrackLimits,
            CheckpointSkip,
            PhysicalShortcut,
            ResetState,
            InvalidLapCompletion,
            Complete
        }

        private GridlineVehicleController vehicle;
        private GridlineTrackData track;
        private GridlineLapSystem laps;
        private GridlineInputRouter input;
        private Phase phase;
        private float phaseElapsed;
        private bool active;
        private bool wrongWayPassed;
        private bool trackLimitsPassed;
        private bool checkpointSkipPassed;
        private bool physicalShortcutPassed;
        private bool resetPassed;
        private bool invalidLapPassed;
        private float resetSpeedAtCall;
        private bool skipInjected;
        private Vector3 shortcutStartPosition;
        private int invalidLapStep;

        // The corrected clockwise Silverstone ordering reaches a different
        // curvature phase at the probe index. Keep this a physical driver
        // timeout, not a vehicle/track tuning knob: the high-steer input must
        // simply be allowed to leave the asphalt before the probe fails.
        private const float PhysicalShortcutTimeout = 8f;

        public void Configure(GridlineVehicleController configuredVehicle,
            GridlineTrackData configuredTrack, GridlineLapSystem configuredLaps)
        {
            vehicle = configuredVehicle;
            track = configuredTrack;
            laps = configuredLaps;
            input = GridlineInputRouter.Instance;
            active = HasArgument("-gridline-qa-rules");
        }

        private void Update()
        {
            if (!active || phase == Phase.Complete || vehicle == null
                || track == null || laps == null) return;
            if (input == null) input = GridlineInputRouter.Instance;
            if (input == null) return;

            if (phase == Phase.Idle)
            {
                GridlineGameState.StartDriving();
                StartWrongWayProbe();
            }

            switch (phase)
            {
                case Phase.WrongWay:
                    input.SetExternalWheelInput(1f, 0f, 0f, 0f);
                    if (laps.InvalidReason == "wrong_way")
                    {
                        wrongWayPassed = true;
                        Debug.Log("Gridline rules QA PASS wrong_way invalidation");
                        StartTrackLimitProbe();
                    }
                    else if (phaseElapsed > 5f)
                    {
                        Fail("wrong_way", laps.InvalidReason);
                    }
                    break;

                case Phase.TrackLimits:
                    input.SetExternalWheelInput(0f, 0f, 0f, 0f);
                    if (laps.InvalidReason == "track_limits")
                    {
                        trackLimitsPassed = true;
                        Debug.Log("Gridline rules QA PASS track_limits invalidation");
                        StartCheckpointSkipProbe();
                    }
                    else if (phaseElapsed > 2f)
                    {
                        Fail("track_limits", laps.InvalidReason);
                    }
                    break;

                case Phase.CheckpointSkip:
                    input.SetExternalWheelInput(0f, 0f, 0f, 0f);
                    if (!skipInjected && phaseElapsed > 0.15f)
                    {
                        // Seed a large progress jump in the live lap state
                        // machine. This is a validator probe, not production
                        // locomotion; a real shortcut must never complete a
                        // lap or skip the ordered checkpoint chain.
                        int skipIndex = Mathf.RoundToInt(track.points.Length * 0.95f);
                        Vector3 skipPosition = track.Point(skipIndex) + Vector3.up * 0.45f;
                        vehicle.Body.position = skipPosition;
                        vehicle.Body.linearVelocity = Vector3.zero;
                        vehicle.Body.angularVelocity = Vector3.zero;
                        skipInjected = true;
                    }
                    else if (skipInjected && phaseElapsed > 0.45f)
                    {
                        checkpointSkipPassed = laps.CompletedLaps == 0
                            && laps.NextCheckpoint > 1
                            && laps.NextCheckpoint < 11;
                        if (checkpointSkipPassed)
                        {
                            Debug.Log($"Gridline rules QA PASS checkpoint_skip next={laps.NextCheckpoint} "
                                + $"completed={laps.CompletedLaps}");
                            StartPhysicalShortcutProbe();
                        }
                        else
                        {
                            Fail("checkpoint_skip", $"next={laps.NextCheckpoint} "
                                + $"completed={laps.CompletedLaps} reason={laps.InvalidReason}");
                        }
                    }
                    break;

                case Phase.PhysicalShortcut:
                    // Deliberately leave the racing line using the real
                    // throttle/steering path. This is a physical shortcut
                    // attempt, not a position-injection probe.
                    input.SetExternalWheelInput(1f, 0f, 0.85f, 0f);
                    float shortcutDistance = Vector3.Distance(
                        vehicle.transform.position, shortcutStartPosition);
                    if (laps.InvalidReason == "track_limits"
                        && Mathf.Abs(vehicle.TrackLateral) > track.halfWidth + 1.5f
                        && shortcutDistance > 18f
                        && laps.CompletedLaps == 0)
                    {
                        physicalShortcutPassed = true;
                        Debug.Log($"Gridline rules QA PASS physical_shortcut distance={shortcutDistance:0.0} "
                            + $"lateral={vehicle.TrackLateral:0.0}");
                        StartResetProbe();
                    }
                    else if (phaseElapsed > PhysicalShortcutTimeout)
                    {
                        Fail("physical_shortcut", $"reason={laps.InvalidReason} "
                            + $"distance={shortcutDistance:0.0} lateral={vehicle.TrackLateral:0.0} "
                            + $"completed={laps.CompletedLaps}");
                    }
                    break;

                case Phase.ResetState:
                    input.SetExternalWheelInput(0f, 0f, 0f, 0f);
                    // Silverstone's start surface has a measurable grade. Test
                    // the reset state before gravity can roll a stationary car
                    // downhill; long-term settling is covered by the vehicle
                    // dynamics reset QA on the level facility.
                    if (phaseElapsed > 0.25f)
                    {
                        resetPassed = laps.IsValidLap && !laps.IsWrongWay
                            && laps.InvalidReason == string.Empty
                            && laps.NextCheckpoint == 1
                            && laps.CompletedLaps == 0
                            && resetSpeedAtCall < 0.01f
                            && Mathf.Abs(vehicle.YawRate) < 0.05f
                            && vehicle.Gear == 1
                            && vehicle.AllWheelsGrounded;
                        if (resetPassed)
                        {
                            Debug.Log("Gridline rules QA PASS reset_state");
                            StartInvalidLapCompletionProbe();
                        }
                        else
                        {
                            Fail("reset_state", $"valid={laps.IsValidLap} reason={laps.InvalidReason} "
                                + $"checkpoint={laps.NextCheckpoint} speedAtReset={resetSpeedAtCall:0.000} "
                                + $"speedNow={vehicle.SpeedKph:0.0} "
                                + $"grounded={vehicle.AllWheelsGrounded}");
                        }
                    }
                    break;

                case Phase.InvalidLapCompletion:
                    input.SetExternalWheelInput(0f, 0f, 0f, 0f);
                    if (phaseElapsed > 2f && invalidLapStep > 12)
                    {
                        invalidLapPassed = laps.CompletedLaps == 1
                            && laps.ValidCompletedLaps == 0
                            && laps.InvalidCompletedLaps == 1
                            && !laps.LastLapWasValid
                            && laps.LastCompletedLapInvalidReason == "track_limits";
                        if (invalidLapPassed)
                        {
                            Debug.Log("Gridline rules QA PASS invalid_lap_excluded "
                                + $"completed={laps.CompletedLaps} valid={laps.ValidCompletedLaps} "
                                + $"invalid={laps.InvalidCompletedLaps} "
                                + $"reason={laps.LastCompletedLapInvalidReason}");
                            Complete();
                        }
                        else
                        {
                            Fail("invalid_lap_excluded", $"completed={laps.CompletedLaps} "
                                + $"valid={laps.ValidCompletedLaps} invalid={laps.InvalidCompletedLaps} "
                                + $"lastValid={laps.LastLapWasValid} "
                                + $"reason={laps.LastCompletedLapInvalidReason}");
                        }
                    }
                    break;
            }
        }

        private void FixedUpdate()
        {
            if (!active || phase == Phase.Complete) return;
            phaseElapsed += Time.fixedDeltaTime;

            if (phase != Phase.InvalidLapCompletion || invalidLapStep > 12
                || vehicle == null || track == null) return;

            int checkpointIndex = invalidLapStep == 12
                ? 0
                : Mathf.RoundToInt(invalidLapStep / 12f * (track.points.Length - 1));
            Vector3 position = track.Point(checkpointIndex) + Vector3.up * 0.45f;
            if (invalidLapStep == 2)
            {
                Vector3 forward = track.Forward(checkpointIndex);
                Vector3 side = new Vector3(forward.z, 0f, -forward.x).normalized;
                position += side * (track.halfWidth + 3f);
            }

            vehicle.Body.linearVelocity = Vector3.zero;
            vehicle.Body.angularVelocity = Vector3.zero;
            vehicle.Body.isKinematic = true;
            vehicle.Body.position = position;
            vehicle.Body.rotation = Quaternion.LookRotation(track.Forward(checkpointIndex), Vector3.up);
            invalidLapStep += 1;
        }

        private void StartWrongWayProbe()
        {
            const int probeIndex = 40;
            Vector3 position = track.Point(probeIndex) + Vector3.up * 0.45f;
            vehicle.ResetForQa(position, Quaternion.LookRotation(-track.Forward(probeIndex), Vector3.up));
            phase = Phase.WrongWay;
            phaseElapsed = 0f;
            Debug.Log("Gridline rules QA wrong_way probe started");
        }

        private void StartTrackLimitProbe()
        {
            const int probeIndex = 120;
            Vector3 forward = track.Forward(probeIndex);
            Vector3 side = new Vector3(forward.z, 0f, -forward.x).normalized;
            Vector3 position = track.Point(probeIndex)
                + side * (track.halfWidth + 3f) + Vector3.up * 0.45f;
            vehicle.ResetForQa(position, Quaternion.LookRotation(forward, Vector3.up));
            phase = Phase.TrackLimits;
            phaseElapsed = 0f;
            Debug.Log("Gridline rules QA track_limits probe started");
        }

        private void StartCheckpointSkipProbe()
        {
            Vector3 position = track.Point(0) + Vector3.up * 0.45f;
            vehicle.ResetForQa(position, Quaternion.LookRotation(track.Forward(0), Vector3.up));
            phase = Phase.CheckpointSkip;
            phaseElapsed = 0f;
            skipInjected = false;
            Debug.Log("Gridline rules QA checkpoint_skip probe started");
        }

        private void StartPhysicalShortcutProbe()
        {
            const int probeIndex = 155;
            Vector3 position = track.Point(probeIndex) + Vector3.up * 0.45f;
            vehicle.ResetForQa(position, Quaternion.LookRotation(track.Forward(probeIndex), Vector3.up));
            shortcutStartPosition = position;
            phase = Phase.PhysicalShortcut;
            phaseElapsed = 0f;
            Debug.Log("Gridline rules QA physical_shortcut probe started");
        }

        private void StartResetProbe()
        {
            Vector3 position = track.Point(0) + Vector3.up * 0.45f;
            vehicle.ResetForQa(position, Quaternion.LookRotation(track.Forward(0), Vector3.up));
            resetSpeedAtCall = vehicle.SpeedKph;
            phase = Phase.ResetState;
            phaseElapsed = 0f;
            Debug.Log("Gridline rules QA reset_state probe started");
        }

        private void StartInvalidLapCompletionProbe()
        {
            phase = Phase.InvalidLapCompletion;
            phaseElapsed = 0f;
            invalidLapStep = 1;
            Debug.Log("Gridline rules QA invalid_lap_excluded probe started");
        }

        private void Complete()
        {
            phase = Phase.Complete;
            input.SetExternalWheelInput(0f, 0f, 0f, 0f);
            Debug.Log($"Gridline rules QA PASS wrong_way={wrongWayPassed} "
                + $"track_limits={trackLimitsPassed} checkpoint_skip={checkpointSkipPassed} "
                + $"physical_shortcut={physicalShortcutPassed} reset={resetPassed} "
                + $"invalid_lap_excluded={invalidLapPassed}");
            Application.Quit(0);
        }

        private void Fail(string probe, string detail)
        {
            Debug.LogError($"Gridline rules QA FAIL probe={probe} detail={detail}");
            phase = Phase.Complete;
            input.SetExternalWheelInput(0f, 0f, 0f, 0f);
            Application.Quit(1);
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
