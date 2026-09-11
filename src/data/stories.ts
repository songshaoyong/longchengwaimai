export type StoryBeat = {
  id: string;
  /** 需要至少完成多少单后才可能刷出 */
  unlockDeliveries: number;
  customer: string;
  food: string;
  kind: "hot" | "fragile" | "normal" | "urgent";
  restaurant?: string;
  dropoff?: string;
  note: string;
  /** 接单时手机聊天气泡 */
  offerHint?: string;
  /** 送达后对话（逐条） */
  afterTalk: { who: string; text: string }[];
};

export type StoryArcId = "longshu" | "ma" | "lin";

export type StoryArc = {
  id: StoryArcId;
  title: string;
  beats: StoryBeat[];
};

/** 1区老街坊常客弧：龙叔 / 老马 / 林小姐 */
export const STORY_ARCS: StoryArc[] = [
  {
    id: "longshu",
    title: "巷尾的白粥",
    beats: [
      {
        id: "longshu-0",
        unlockDeliveries: 0,
        customer: "龙叔",
        food: "白粥",
        kind: "hot",
        restaurant: "老马粥铺",
        dropoff: "巷尾绿窗",
        note: "放门口就行，别敲门。",
        offerHint: "常客单 · 龙叔",
        afterTalk: [
          { who: "龙叔", text: "……放那儿就行。谢谢。" },
          { who: "老马", text: "龙叔每天一碗粥。别问太多，把热的送到就好。" },
        ],
      },
      {
        id: "longshu-1",
        unlockDeliveries: 3,
        customer: "龙叔",
        food: "白粥",
        kind: "hot",
        restaurant: "老马粥铺",
        dropoff: "巷尾绿窗",
        note: "今天多加一勺糖，他孙女以前爱吃甜的。",
        offerHint: "龙叔 · 加糖",
        afterTalk: [
          { who: "龙叔", text: "甜的……她也爱甜的。" },
          { who: "龙叔", text: "没事。你忙你的。" },
          { who: "老马", text: "看见没？有些单，送的不只是饭。" },
        ],
      },
      {
        id: "longshu-2",
        unlockDeliveries: 8,
        customer: "龙叔",
        food: "白粥",
        kind: "hot",
        restaurant: "老马粥铺",
        dropoff: "巷尾绿窗",
        note: "雨天也要热的。门口鞋摆整齐就说明他在家。",
        offerHint: "龙叔 · 雨天",
        afterTalk: [
          { who: "龙叔", text: "进来避一下雨？……算了，别湿了车。" },
          { who: "龙叔", text: "下次，如果方便，帮我带盒火柴。灶台受潮了。" },
          { who: "老马", text: "他开口求人了。难得。你记着。" },
        ],
      },
    ],
  },
  {
    id: "ma",
    title: "老马的规矩",
    beats: [
      {
        id: "ma-0",
        unlockDeliveries: 2,
        customer: "夜班保安老刘",
        food: "云吞面",
        kind: "hot",
        restaurant: "老马粥铺",
        dropoff: "岗亭",
        note: "老马让你顺路练一单，注意别洒汤。",
        offerHint: "老马指派",
        afterTalk: [
          { who: "老马", text: "汤洒了客户不骂你，锅会骂我。平一点。" },
          { who: "老马", text: "胡同能抄就抄，大街堵成狗的时候别硬刚。" },
        ],
      },
      {
        id: "ma-1",
        unlockDeliveries: 6,
        customer: "王阿姨",
        food: "白粥",
        kind: "hot",
        restaurant: "老马粥铺",
        dropoff: "3栋2单元",
        note: "老马：这单给你加两块钱油钱，别跟平台说。",
        offerHint: "老马私单",
        afterTalk: [
          { who: "老马", text: "平台算法不认人情，骑手认。" },
          { who: "老马", text: "你要是哪天不想跑了，粥铺洗碗的位子还空着。——开玩笑的。" },
        ],
      },
      {
        id: "ma-2",
        unlockDeliveries: 12,
        customer: "阿琳",
        food: "肠粉",
        kind: "normal",
        restaurant: "阿琳面馆",
        dropoff: "夜市阁楼",
        note: "老马让你把这单亲手交给阿琳，顺便问问她夜路安不安全。",
        offerHint: "老马 · 阿琳",
        afterTalk: [
          { who: "阿琳", text: "老马又让你当传声筒？跟他说一声：我自己有分寸。" },
          { who: "老马", text: "她嘴硬。你夜里撞见她，跟一段路也行。" },
        ],
      },
    ],
  },
  {
    id: "lin",
    title: "会议室的咖啡",
    beats: [
      {
        id: "lin-0",
        unlockDeliveries: 4,
        customer: "林小姐",
        food: "美式咖啡",
        kind: "hot",
        restaurant: "龙城茶餐厅",
        dropoff: "城中公寓",
        note: "电话别响，会议室。咖啡不要洒键盘上。",
        offerHint: "常客 · 林小姐",
        afterTalk: [
          { who: "林小姐", text: "谢了。加班到现在，全靠这杯。" },
          { who: "林小姐", text: "下次如果还是我，备注里写楼层就行，别打电话。" },
        ],
      },
      {
        id: "lin-1",
        unlockDeliveries: 9,
        customer: "林小姐",
        food: "珍珠奶茶",
        kind: "fragile",
        restaurant: "港式冰室",
        dropoff: "城中公寓",
        note: "今天不加班。想喝甜的。别晃。",
        offerHint: "林小姐 · 休息日",
        afterTalk: [
          { who: "林小姐", text: "……居然没洒。你比上一个骑手靠谱。" },
          { who: "林小姐", text: "你也注意休息。别学我们这种。" },
        ],
      },
      {
        id: "lin-2",
        unlockDeliveries: 15,
        customer: "林小姐",
        food: "草莓蛋糕",
        kind: "fragile",
        restaurant: "霓虹寿司",
        dropoff: "城中公寓",
        note: "同事升职，我点的庆祝。盒子放平。",
        offerHint: "林小姐 · 仪式感",
        afterTalk: [
          { who: "林小姐", text: "其实不是同事。是我自己。就……想吃一口甜的。" },
          { who: "林小姐", text: "别跟别人说。骑手保密条例，有吧？" },
          { who: "老马", text: "有。嘴严的骑手，活得长。" },
        ],
      },
    ],
  },
];

export type StoryProgress = Record<StoryArcId, number>;

export function defaultStoryProgress(): StoryProgress {
  return { longshu: 0, ma: 0, lin: 0 };
}

export function nextBeat(arcId: StoryArcId, progress: StoryProgress): StoryBeat | null {
  const arc = STORY_ARCS.find((a) => a.id === arcId);
  if (!arc) return null;
  const idx = progress[arcId] ?? 0;
  return arc.beats[idx] ?? null;
}

/** 按解锁条件选出下一条可刷出的剧情单（优先龙叔→老马→林小姐） */
export function pickAvailableStory(progress: StoryProgress, deliveries: number): { arcId: StoryArcId; beat: StoryBeat } | null {
  for (const arc of STORY_ARCS) {
    const beat = nextBeat(arc.id, progress);
    if (!beat) continue;
    if (deliveries >= beat.unlockDeliveries) return { arcId: arc.id, beat };
  }
  return null;
}
