import { Image } from "expo-image";
import { View } from "react-native";
import { SheetManager } from "react-native-actions-sheet";
import { StyleSheet } from "react-native-unistyles";

import startImage1 from "@/assets/images/start-food-1.jpg";
import startImage10 from "@/assets/images/start-food-10.jpg";
import startImage11 from "@/assets/images/start-food-11.jpg";
import startImage12 from "@/assets/images/start-food-12.jpg";
import startImage2 from "@/assets/images/start-food-2.jpg";
import startImage3 from "@/assets/images/start-food-3.jpg";
import startImage4 from "@/assets/images/start-food-4.jpg";
import startImage5 from "@/assets/images/start-food-5.jpg";
import startImage6 from "@/assets/images/start-food-6.jpg";
import startImage7 from "@/assets/images/start-food-7.jpg";
import startImage8 from "@/assets/images/start-food-8.jpg";
import startImage9 from "@/assets/images/start-food-9.jpg";
import { Marquee } from "@/components/Marquee";
import { SafeAreaView } from "@/components/SafeAreaView";
import { VSpace } from "@/components/Space";
import { Text } from "@/components/Text";
import { PrimaryButton } from "@/components/buttons/PrimaryButton";

const row1Images = [startImage1, startImage2, startImage3, startImage4];
const row2Images = [startImage5, startImage6, startImage7, startImage8];
const row3Images = [startImage9, startImage10, startImage11, startImage12];

const getImageRow = (imageArr: string[]) =>
  imageArr.map((image) => (
    <Image
      key={image}
      source={image}
      style={{ width: 148, height: 148, borderRadius: 12 }}
    />
  ));

export default function StartScreen() {
  const onPressGetStarted = () => SheetManager.show("sign-up-sheet");

  return (
    <View style={styles.screenContainer}>
      <Marquee
        offset={0}
        spacing={12}
        direction="horizontal"
        speed={0.12}
        style={{ marginTop: -16, paddingVertical: 8 }}
      >
        <View style={{ flexDirection: "row", gap: 12 }}>
          {getImageRow(row1Images)}
        </View>
      </Marquee>
      <Marquee
        offset={22}
        spacing={12}
        direction="horizontal"
        speed={0.08}
        reverse
        style={{ paddingVertical: 6 }}
      >
        <View style={{ flexDirection: "row", gap: 12 }}>
          {getImageRow(row2Images)}
        </View>
      </Marquee>
      <Marquee
        offset={64}
        spacing={12}
        direction="horizontal"
        speed={0.1}
        style={{ paddingVertical: 6 }}
      >
        <View style={{ flexDirection: "row", gap: 12 }}>
          {getImageRow(row3Images)}
        </View>
      </Marquee>
      <SafeAreaView style={styles.safeArea} edges={["bottom"]}>
        <View />
        <View style={styles.textContainer}>
          <Text type="largeTitle">
            cook
            <Text type="largeTitle" style={styles.clubText}>
              club
            </Text>
          </Text>
          <VSpace size={24} />
          <Text style={styles.subheader} type="bodyFaded">
            Turn leftovers into
          </Text>
          <VSpace size={8} />
          <Text style={[styles.subheader, styles.masterpiecesText]}>
            masterpieces
          </Text>
        </View>
        <PrimaryButton onPress={onPressGetStarted}>Get started</PrimaryButton>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create((theme, rt) => ({
  screenContainer: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  safeArea: {
    flex: 1,
    paddingHorizontal: 24,
    justifyContent: "space-between",
    alignItems: "center",
  },
  textContainer: {
    alignItems: "center",
    textAlign: "center",
  },
  clubText: {
    color: theme.colors.primary,
  },
  subheader: { fontSize: 21 },
  masterpiecesText: {
    fontFamily: theme.fonts.italic,
  },
}));
