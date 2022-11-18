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
  <div class="title">Guntenaar.org</div>
  <div class="subtitle">which Guntenaar are you looking for?</div>
  <div class="overlay">
    <div class="name">{{ name }}</div>
  </div>
  <div class="swiper-container">
    <div class="swiper-wrapper">
      <div class="container-general">
        <div class="gallery-wrap wrap-effect-1">
          <div class="item">
            <div class="description">joost.guntenaar.org</div>
          </div>
          <div class="item">
            <div class="description">flexinhouse.nl <br />zgdrone.com</div>
          </div>
          <div class="item">
            <div class="description">geforcy.com <br />thomasguntenaar.com</div>
          </div>
          <div class="item">
            <div class="description">olivierguntenaar.com</div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style lang="scss">
@import url("https://fonts.googleapis.com/css?family=Roboto+Slab");

.title {
  color: white;
  font-size: 3rem;
  margin: 20px;
}

.subtitle {
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

.overlay {
  width: 100%;
  pointer-events: none;
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  visibility: hidden; // FIXME:
  // transition-timing-function: ease-in;
  .name {
    color: white;
    font-size: 3rem;
    margin-top: 750px;
    // margin: 20px;
  }
}

// Image Accordions General
.container-general {
  margin: 0 auto;
  width: 1000px;
  .gallery-wrap {
    display: flex;
    flex-direction: row;
    width: 100%;
    height: 80vh;
    border-radius: 20px; //FIXME:

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
        margin: 20px;
        bottom: 20px;
        left: 20px;
        position: absolute;
        opacity: 0;
        text-align: left;
        -webkit-transition: opacity 0.5s ease-in-out;
        -moz-transition: opacity 0.5s ease-in-out;
        transition: opacity 0.9s ease-in-out;
      }
      &:hover {
        flex: 7;
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
