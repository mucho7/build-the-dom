export type Stadium = {
  id: string;
  name: string;
  kboNames: string[];
  latitude: number;
  longitude: number;
  isDome: boolean;
};

export const stadiums: Stadium[] = [
  { id: "jamsil", name: "잠실야구장", kboNames: ["잠실"], latitude: 37.5122, longitude: 127.0719, isDome: false },
  { id: "gocheok", name: "고척스카이돔", kboNames: ["고척"], latitude: 37.4982, longitude: 126.8671, isDome: true },
  { id: "incheon", name: "인천SSG랜더스필드", kboNames: ["문학", "인천"], latitude: 37.4369, longitude: 126.6932, isDome: false },
  { id: "suwon", name: "수원KT위즈파크", kboNames: ["수원"], latitude: 37.2997, longitude: 127.0098, isDome: false },
  { id: "daejeon", name: "대전 한화생명 볼파크", kboNames: ["대전"], latitude: 36.3171, longitude: 127.4292, isDome: false },
  { id: "daegu", name: "대구삼성라이온즈파크", kboNames: ["대구"], latitude: 35.841, longitude: 128.681, isDome: false },
  { id: "gwangju", name: "광주-기아 챔피언스 필드", kboNames: ["광주"], latitude: 35.1681, longitude: 126.8891, isDome: false },
  { id: "busan", name: "사직야구장", kboNames: ["사직"], latitude: 35.1942, longitude: 129.0618, isDome: false },
  { id: "changwon", name: "창원NC파크", kboNames: ["창원"], latitude: 35.2225, longitude: 128.5826, isDome: false },
];

export function getStadium(stadiumId: string) {
  return stadiums.find((stadium) => stadium.id === stadiumId) ?? null;
}

export function getStadiumByKboName(kboName: string) {
  return stadiums.find((stadium) => stadium.kboNames.includes(kboName)) ?? null;
}
