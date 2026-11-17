Shader "Gridline/GLB Unlit"
{
    Properties
    {
        [MainTexture] _MainTex ("Base Color", 2D) = "white" {}
        [MainColor] _Color ("Color", Color) = (1,1,1,1)
        _TextureMix ("Texture Mix", Range(0,1)) = 1
    }

    SubShader
    {
        Tags { "RenderType"="Opaque" "Queue"="Geometry" }
        LOD 100
        Cull Off
        ZWrite On

        Pass
        {
            CGPROGRAM
            #pragma vertex vert
            #pragma fragment frag
            #pragma target 2.0
            #include "UnityCG.cginc"

            fixed4 _Color;
            float _TextureMix;
            sampler2D _MainTex;
            float4 _MainTex_ST;

            struct appdata
            {
                float4 vertex : POSITION;
                float2 uv : TEXCOORD0;
            };

            struct v2f
            {
                float4 vertex : SV_POSITION;
                float2 uv : TEXCOORD0;
            };

            v2f vert(appdata input)
            {
                v2f output;
                output.vertex = UnityObjectToClipPos(input.vertex);
                output.uv = TRANSFORM_TEX(input.uv, _MainTex);
                return output;
            }

            fixed4 frag(v2f input) : SV_Target
            {
                fixed4 textureColor = tex2D(_MainTex, input.uv);
                // BaseColor already contains the livery. Multiplying it by the
                // semantic fallback tint turned the Ferrari into a flat red
                // silhouette on Metal; tint only the untextured fallback.
                fixed3 color = lerp(_Color.rgb, textureColor.rgb * 1.05, _TextureMix);
                return fixed4(saturate(color), _Color.a);
            }
            ENDCG
        }
    }
}
