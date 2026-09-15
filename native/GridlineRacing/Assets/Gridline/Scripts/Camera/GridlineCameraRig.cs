using UnityEngine;

namespace Gridline.Native
{
    public sealed class GridlineCameraRig : MonoBehaviour
    {
        public Transform Target;

        [SerializeField] private Vector3 localOffset = new Vector3(0f, 4.3f, -8.5f);
        [SerializeField] private float positionSmooth = 0.08f;
        [SerializeField] private float lookAhead = 8.5f;

        private Vector3 velocity;

        private void LateUpdate()
        {
            if (Target == null)
            {
                return;
            }

            Vector3 desiredPosition = Target.position + Target.TransformDirection(localOffset);
            transform.position = Vector3.SmoothDamp(transform.position, desiredPosition, ref velocity, positionSmooth);

            Vector3 lookPoint = Target.position + Vector3.up * 1.15f + Target.forward * lookAhead;
            Quaternion desiredRotation = Quaternion.LookRotation(lookPoint - transform.position, Vector3.up);
            transform.rotation = Quaternion.Slerp(transform.rotation, desiredRotation, Time.deltaTime * 8f);
        }
    }
}
