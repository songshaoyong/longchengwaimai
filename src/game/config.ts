export const GRID_N = 15;
export const CELL = 46;
export const ROAD_W = 10.5;
export const CITY_SPAN = (GRID_N - 1) * CELL;

// 路面分层(北京式横截面):机动车道 + 绿化带 + 非机动车道 + 人行道
export const MOTOR_HALF = 2.5; // 机动车道半宽
export const GREEN_W = 0.55; // 绿化带宽
export const LANE_W = 2.3; // 非机动车道宽
/** 路中心 → 右侧非机动车道中心（骑手默认跑这里） */
export const BIKE_LANE = MOTOR_HALF + GREEN_W + LANE_W / 2;
/** 横向可动范围：可蹭进机动车道躲障，但默认落在非机动车道 */
export const ROAD_HALF = BIKE_LANE + LANE_W / 2 + 0.35;
export const RIBBON_MAX = 960;

/** 胡同：尺度断崖（大街 ~10m → 胡同 ~4m） */
export const HUTONG_W = 4.0;
export const HUTONG_HALF = HUTONG_W / 2;
export const HUTONG_SPEED = 0.52; // 进胡同限速
export const HUTONG_STRAFE = 1.15; // 胡同内左右余地

export const RUNNER = {
  baseSpeed: 15.5,
  maxSpeed: 24,
  boost: 7,
  jump: 12.5,
  gravity: 30,
  slideTime: 0.68,
  strafe: 15,
  invuln: 0.85,
};

export {
  CUSTOMERS,
  DISTRICT_1,
  FOODS,
  H_STREETS,
  RANK_THRESHOLDS,
  RESTAURANTS,
  V_STREETS,
  CUSTOMER_LINES,
} from "../data/catalog";
