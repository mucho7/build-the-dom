export type Stadium = {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  isDome: boolean;
};

export const stadiums: Stadium[] = [
  { id: "jamsil", name: "잠실야구장", latitude: 37.5122, longitude: 127.0719, isDome: false },
  { id: "gocheok", name: "고척스카이돔", latitude: 37.4982, longitude: 126.8671, isDome: true },
  { id: "incheon", name: "인천SSG랜더스필드", latitude: 37.4369, longitude: 126.6932, isDome: false },
  { id: "suwon", name: "수원KT위즈파크", latitude: 37.2997, longitude: 127.0098, isDome: false },
  { id: "daejeon", name: "대전 한화생명 볼파크", latitude: 36.3171, longitude: 127.4292, isDome: false },
  { id: "daegu", name: "대구삼성라이온즈파크", latitude: 35.841, longitude: 128.681, isDome: false },
  { id: "gwangju", name: "광주-기아 챔피언스 필드", latitude: 35.1681, longitude: 126.8891, isDome: false },
  { id: "busan", name: "사직야구장", latitude: 35.1942, longitude: 129.0618, isDome: false },
  { id: "changwon", name: "창원NC파크", latitude: 35.2225, longitude: 128.5826, isDome: false },
];

export function getStadium(stadiumId: string) {
  return stadiums.find((stadium) => stadium.id === stadiumId) ?? null;
}
