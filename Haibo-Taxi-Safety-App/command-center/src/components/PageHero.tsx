import React from "react";
import { colors, fonts, gradients, radius, spacing, shadows } from "../lib/brand";

interface PageHeroProps {
  eyebrow?: React.ReactNode;
  title: string;
  titleAccent?: string;
  subtitle?: React.ReactNode;
  imageUrl?: string;
}

export function PageHero({
  eyebrow,
  title,
  titleAccent,
  subtitle,
  imageUrl,
}: PageHeroProps) {
  return (
    <section
      style={{
        position: "relative",
        overflow: "hidden",
        padding: `80px ${spacing["3xl"]}px 60px`,
        minHeight: 280,
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
      }}
    >
      {imageUrl ? (
        <>
          <img
            src={imageUrl}
            alt=""
            aria-hidden
            style={{
              position: "absolute",
              inset: 0,
              width: "100%",
              height: "100%",
              objectFit: "cover",
              zIndex: 0,
            }}
          />
          <div
            style={{
              position: "absolute",
              inset: 0,
              background: "linear-gradient(135deg, rgba(231,35,105,0.82) 0%, rgba(12,18,26,0.72) 100%)",
              zIndex: 1,
            }}
          />
        </>
      ) : (
        <>
          <div
            style={{
              position: "absolute",
              inset: 0,
              background: colors.background,
              zIndex: 0,
            }}
          />
          <div
            style={{
              position: "absolute",
              top: -120,
              right: -80,
              width: 500,
              height: 500,
              borderRadius: "50%",
              background: colors.haiboPink,
              opacity: 0.06,
              filter: "blur(100px)",
              zIndex: 1,
            }}
          />
        </>
      )}

      <div style={{ position: "relative", zIndex: 2, maxWidth: 720 }}>
        {eyebrow && (
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              background: imageUrl ? "rgba(255,255,255,0.18)" : colors.roseFaint,
              padding: "6px 14px",
              borderRadius: radius.full,
              marginBottom: spacing.lg,
              fontSize: 12,
              fontWeight: 800,
              fontFamily: fonts.sans,
              letterSpacing: 0.8,
              color: imageUrl ? "#FFFFFF" : colors.haiboPink,
              textTransform: "uppercase",
            }}
          >
            {eyebrow}
          </div>
        )}
        <h1
          style={{
            fontFamily: fonts.heading,
            fontSize: 42,
            fontWeight: 800,
            lineHeight: 1.15,
            letterSpacing: -0.6,
            color: imageUrl ? "#FFFFFF" : colors.foreground,
            margin: 0,
          }}
        >
          {title}
          {titleAccent && (
            <>
              {" "}
              <span
                style={{
                  background: imageUrl
                    ? "none"
                    : gradients.primary,
                  WebkitBackgroundClip: imageUrl ? undefined : "text",
                  WebkitTextFillColor: imageUrl ? "#FFFFFF" : "transparent",
                }}
              >
                {titleAccent}
              </span>
            </>
          )}
        </h1>
        {subtitle && (
          <p
            style={{
              fontFamily: fonts.sans,
              fontSize: 17,
              lineHeight: 1.6,
              color: imageUrl ? "rgba(255,255,255,0.85)" : colors.mutedForeground,
              marginTop: spacing.lg,
              maxWidth: 560,
            }}
          >
            {subtitle}
          </p>
        )}
      </div>
    </section>
  );
}

export default PageHero;
