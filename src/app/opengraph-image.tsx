import { ImageResponse } from "next/og";

export const alt = "Beevo Go — ink-free pocket thermal printer";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

/** A first-party, always-available social preview image for search and shares. */
export default function OpenGraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          background: "#FAF7F0",
          color: "#1D1912",
          display: "flex",
          height: "100%",
          width: "100%",
          padding: "64px 76px",
          position: "relative",
        }}
      >
        <div
          style={{
            alignItems: "center",
            display: "flex",
            fontSize: 35,
            fontWeight: 800,
            letterSpacing: "-1px",
            position: "absolute",
            top: 55,
          }}
        >
          beevo<span style={{ color: "#E4520E" }}>.</span>
        </div>
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            maxWidth: 690,
          }}
        >
          <div
            style={{
              color: "#A6400B",
              display: "flex",
              fontSize: 22,
              fontWeight: 700,
              letterSpacing: "2px",
              marginBottom: 20,
              textTransform: "uppercase",
            }}
          >
            Pocket thermal printer
          </div>
          <div
            style={{
              display: "flex",
              fontFamily: "serif",
              fontSize: 75,
              fontWeight: 700,
              letterSpacing: "-3px",
              lineHeight: 1.03,
            }}
          >
            Print anything. No ink, ever.
          </div>
          <div
            style={{
              color: "#625C51",
              display: "flex",
              fontSize: 29,
              lineHeight: 1.35,
              marginTop: 27,
            }}
          >
            Notes, labels, lists and QR codes from your phone.
          </div>
        </div>
        <div
          style={{
            alignItems: "center",
            background: "#1D1912",
            borderRadius: 45,
            bottom: 70,
            display: "flex",
            height: 250,
            justifyContent: "center",
            position: "absolute",
            right: 74,
            width: 300,
          }}
        >
          <div
            style={{
              background: "white",
              border: "12px solid #1D1912",
              borderRadius: 20,
              display: "flex",
              height: 135,
              position: "absolute",
              top: -46,
              width: 185,
            }}
          >
            <div
              style={{
                background: "#E4520E",
                borderRadius: 6,
                height: 9,
                left: 31,
                position: "absolute",
                top: 36,
                width: 108,
              }}
            />
            <div
              style={{
                background: "#E4520E",
                borderRadius: 6,
                height: 9,
                left: 31,
                position: "absolute",
                top: 61,
                width: 72,
              }}
            />
          </div>
          <div
            style={{
              background: "#E4520E",
              borderRadius: 999,
              bottom: 52,
              display: "flex",
              height: 20,
              position: "absolute",
              right: 46,
              width: 20,
            }}
          />
          <div
            style={{
              background: "#FAF7F0",
              bottom: -50,
              display: "flex",
              height: 64,
              position: "absolute",
              width: 130,
            }}
          />
        </div>
      </div>
    ),
    size,
  );
}
