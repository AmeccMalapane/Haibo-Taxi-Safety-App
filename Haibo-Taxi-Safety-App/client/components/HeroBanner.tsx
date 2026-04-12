import React, { useState, useEffect, useRef } from "react";
import {
  View,
  FlatList,
  Pressable,
  StyleSheet,
  Dimensions,
  NativeSyntheticEvent,
  NativeScrollEvent,
} from "react-native";
import { Image } from "expo-image";
import { Feather } from "@expo/vector-icons";
import { ThemedText } from "@/components/ThemedText";
import { Spacing, BrandColors, BorderRadius } from "@/constants/theme";

const slide1 = require("../../attached_assets/stock_images/south_african_minibu_16d7d5f3.jpg");
const slide2 = require("../../attached_assets/stock_images/south_african_minibu_bc6536a8.jpg");
const slide3 = require("../../attached_assets/stock_images/south_african_minibu_eefd5e6d.jpg");

const SCREEN_WIDTH = Dimensions.get("window").width;
const BANNER_WIDTH = SCREEN_WIDTH - Spacing.lg * 2;
const BANNER_HEIGHT = 180;
const SLIDE_INTERVAL = 4000;

const SLIDES = [
  { id: "1", image: slide1 },
  { id: "2", image: slide2 },
  { id: "3", image: slide3 },
];

interface HeroBannerProps {
  onContributePress: () => void;
}

export function HeroBanner({ onContributePress }: HeroBannerProps) {
  const [activeIndex, setActiveIndex] = useState(0);
  const flatListRef = useRef<FlatList>(null);
  const autoScrollRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    startAutoScroll();
    return () => stopAutoScroll();
  }, [activeIndex]);

  const startAutoScroll = () => {
    stopAutoScroll();
    autoScrollRef.current = setTimeout(() => {
      const nextIndex = (activeIndex + 1) % SLIDES.length;
      flatListRef.current?.scrollToIndex({ index: nextIndex, animated: true });
    }, SLIDE_INTERVAL);
  };

  const stopAutoScroll = () => {
    if (autoScrollRef.current) {
      clearTimeout(autoScrollRef.current);
      autoScrollRef.current = null;
    }
  };

  const onScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const offsetX = event.nativeEvent.contentOffset.x;
    const index = Math.round(offsetX / BANNER_WIDTH);
    if (index !== activeIndex && index >= 0 && index < SLIDES.length) {
      setActiveIndex(index);
    }
  };

  const renderSlide = ({ item }: { item: (typeof SLIDES)[0] }) => (
    <View style={[styles.slide, { width: BANNER_WIDTH }]}>
      <Image source={item.image} style={styles.slideImage} contentFit="cover" />
      <View style={styles.overlay} />
    </View>
  );

  return (
    <View style={styles.container}>
      <FlatList
        ref={flatListRef}
        data={SLIDES}
        renderItem={renderSlide}
        keyExtractor={(item) => item.id}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onScroll={onScroll}
        scrollEventThrottle={16}
        onScrollBeginDrag={stopAutoScroll}
        onScrollEndDrag={startAutoScroll}
        getItemLayout={(_, index) => ({
          length: BANNER_WIDTH,
          offset: BANNER_WIDTH * index,
          index,
        })}
      />

      <View style={styles.content}>
        <View style={styles.textContainer}>
          <ThemedText style={styles.title}>Know Your Route</ThemedText>
          <ThemedText style={styles.subtitle}>
            Help fellow commuters by sharing route info and fares
          </ThemedText>
        </View>

        <Pressable style={styles.contributeButton} onPress={onContributePress}>
          <Feather name="plus-circle" size={18} color="#FFFFFF" />
          <ThemedText style={styles.buttonText}>Contribute</ThemedText>
        </Pressable>
      </View>

      <View style={styles.pagination}>
        {SLIDES.map((_, index) => (
          <View
            key={index}
            style={[
              styles.paginationDot,
              index === activeIndex ? styles.paginationDotActive : null,
            ]}
          />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    height: BANNER_HEIGHT,
    marginHorizontal: Spacing.lg,
    marginTop: Spacing.md,
    borderRadius: BorderRadius.md,
    overflow: "hidden",
    position: "relative",
  },
  slide: {
    height: BANNER_HEIGHT,
  },
  slideImage: {
    width: "100%",
    height: "100%",
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0, 0, 0, 0.45)",
  },
  content: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    top: 0,
    padding: Spacing.md,
    justifyContent: "space-between",
  },
  textContainer: {
    flex: 1,
    justifyContent: "center",
  },
  title: {
    color: "#FFFFFF",
    fontSize: 22,
    fontWeight: "700",
    marginBottom: Spacing.xs,
  },
  subtitle: {
    color: "rgba(255, 255, 255, 0.9)",
    fontSize: 14,
    maxWidth: "80%",
  },
  contributeButton: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    backgroundColor: BrandColors.primary.green,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.full,
    gap: Spacing.xs,
  },
  buttonText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "600",
  },
  pagination: {
    position: "absolute",
    bottom: Spacing.sm,
    right: Spacing.md,
    flexDirection: "row",
    gap: 6,
  },
  paginationDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "rgba(255, 255, 255, 0.5)",
  },
  paginationDotActive: {
    backgroundColor: "#FFFFFF",
    width: 18,
  },
});
