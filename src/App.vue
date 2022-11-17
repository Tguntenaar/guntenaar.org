<script setup lang="ts">
import { Swiper, SwiperSlide } from "swiper/vue";

// Import Swiper styles
import "swiper/css";

const onSwiper = (swiper) => {
  console.log(swiper);
};
const onSlideChange = () => {
  console.log("slide change");
};
</script>

<template>
  <div class="title">Guntenaar.org</div>
  <div class="subtitle">which Guntenaar are you looking for?</div>
  <div class="swiper-container">
    <div class="swiper-wrapper">
      <swiper
        :slides-per-view="3"
        :space-between="40"
        @swiper="onSwiper"
        @slideChange="onSlideChange"
        direction="vertical"
      >
        <swiper-slide>
          <div class="container-general">
            <div class="gallery-wrap wrap-effect-1">
              <div class="item"></div>
              <div class="item"></div>
              <div class="item"></div>
              <div class="item"></div>
            </div>
          </div>
        </swiper-slide>
      </swiper>
    </div>
  </div>
</template>

<style lang="scss">
@import url("https://fonts.googleapis.com/css?family=Roboto+Slab");

.title {
  font-family: "Roboto Slab", serif;
  color: white;
  font-size: 3rem;
  margin: 20px;
}

.subtitle {
  font-family: "Roboto Slab", serif;
  color: white;
  font-size: 1rem;
  margin: 20px;
}

html,
body {
  position: relative;
  width: 100%;
  height: 100%;
}

body {
  font-family: "Roboto Slab", serif;
  color: #000;
  margin: 0;
  padding: 0;
}

.swiper-container {
  width: 100%;
  height: 90%;
}
.swiper-slide {
  text-align: center;
  background: #fff;
  /* Center slide text vertically */
  display: flex;
  justify-content: center;
  align-items: center;
}

// Image Accordions General
.container-general {
  padding: 75px 0;
  margin: 0 auto;
  width: 800px;
  border-radius: 20px;

  .gallery-wrap {
    display: flex;
    flex-direction: row;
    width: 100%;
    height: 90vh;
    .item {
      flex: 1;
      height: 100%;
      background-position: center;
      background-size: cover;
      background-repeat: none;
      transition: all 0.8s ease;
      &:hover {
        flex: 7;
      }
    }
  }
}

// Image Accordions Effect 1
.wrap-effect-1 {
  .item {
    &:first-of-type {
      // './assets/zgdrone.png'
      // background-image: url("https://cdn.dribbble.com/users/729829/screenshots/4185141/galshir-cactus-coffee.png");
      background-image: url("assets/boris.jpeg");
    }
    &:nth-of-type(2) {
      background-image: url("assets/joost.jpeg");

      // background-image: url("https://cdn.dribbble.com/users/729829/screenshots/6146136/galshir-tea-biscuit_2x.png");
    }
    &:nth-of-type(3) {
      background-image: url("assets/thomas.jpeg");

      // background-image: url("https://cdn.dribbble.com/users/729829/screenshots/4473482/galshir-dog-walker.gif");
    }
    &:nth-of-type(4) {
      background-image: url("assets/olivier.jpeg");

      // background-image: url("https://cdn.dribbble.com/users/729829/screenshots/5743606/gal-shir-scooter_2x.png");
    }
    &:last-of-type {
      background-image: url("assets/olivier.jpeg");

      // background-image: url("https://cdn.dribbble.com/users/729829/screenshots/4738104/galshir-storytime.png");
    }
  }
}
</style>
