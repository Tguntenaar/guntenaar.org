<script setup lang="ts">
import { ref } from "vue";
const onSwiper = () => {
  // console.log(swiper);
};
const onSlideChange = () => {
  console.log("slide change");
};
const name = ref("Thomas");
</script>

<template>
  <div class="svg-curves"></div>
  <div class="text-white text-5xl m-5">Guntenaar.org</div>
  <div class="w-full h-full cursor-pointer m-10">
    <div class="swiper-wrapper">
      <div class="mx-auto my-0 container-general">
        <div
          class="gallery-wrap w-full flex flex-wrap rounded-2xl wrap-effect-1"
        >
          <div class="item">
            <div class="m-5 description">
              joost.guntenaar.org <br />joostguntenaar.com
            </div>
            <div class="m-5 description discipline">Photography</div>
          </div>
          <div class="item">
            <div class="m-5 description">flexinhouse.nl <br />zgdrone.com</div>
            <div class="m-5 description discipline">
              Accounting <br />Drones Industries
            </div>
          </div>
          <div class="item">
            <div class="m-5 description">
              geforcy.com <br />thomasguntenaar.com
            </div>
            <div class="m-5 description discipline">Software Engineer</div>
          </div>
          <div class="item">
            <div class="m-5 description">olivierguntenaar.com</div>
            <div class="m-5 description discipline">Software Engineer</div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style lang="scss">
@import url("https://fonts.googleapis.com/css?family=Roboto+Slab");

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

body {
  width: 100%;
  background: url("./assets/layered-peaks-haikei.svg");
  background-repeat: no-repeat;
  background-position: bottom;
  background-size: cover;
  bottom: 0;
  overflow-y: hidden;
}

// Image Accordions General
.container-general {
  // visibility: hidden;
  width: 1400px;
  .gallery-wrap {
    height: 80vh;

    .item {
      flex: 1;
      height: 100%;
      background-position: center;
      background-size: cover;
      background-repeat: none;

      transition: all 0.8s ease;
      position: relative;

      .description {
        color: white;
        bottom: 20px;
        left: 20px;
        position: absolute;
        opacity: 0;
        text-align: left;
        -webkit-transition: opacity 0.5s ease-in-out;
        -moz-transition: opacity 0.5s ease-in-out;
        transition: opacity 0.9s ease-in-out;
      }

      .discipline {
        text-align: right;
        left: inherit;
        right: 20px;
      }

      &:hover {
        flex: 5;
        .description {
          opacity: 1;
        }
      }
    }
  }
}

$border-rad: 20px;
// Image Accordions Effect 1
.wrap-effect-1 {
  .item {
    &:first-of-type {
      // './assets/zgdrone.png'
      // background-image: url("https://cdn.dribbble.com/users/729829/screenshots/4185141/galshir-cactus-coffee.png");
      background-image: url("assets/joost.jpeg");
      border-top-left-radius: $border-rad;
      border-bottom-left-radius: $border-rad;
    }
    &:nth-of-type(2) {
      background-image: url("assets/boris.jpeg");

      // background-image: url("https://cdn.dribbble.com/users/729829/screenshots/6146136/galshir-tea-biscuit_2x.png");
    }
    &:nth-of-type(3) {
      background-image: url("assets/thomas.jpeg");

      // background-image: url("https://cdn.dribbble.com/users/729829/screenshots/4473482/galshir-dog-walker.gif");
    }
    &:nth-of-type(4) {
      background-image: url("assets/olivier.jpeg");
      border-top-right-radius: $border-rad;
      border-bottom-right-radius: $border-rad;
      // background-image: url("https://cdn.dribbble.com/users/729829/screenshots/5743606/gal-shir-scooter_2x.png");
    }
  }
}
</style>
