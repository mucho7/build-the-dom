# 우취될까?

KBO 경기의 기상청 예보와 최근 3년 우천취소 이력을 바탕으로, **“오늘 직관을 가도 될까?”**를 빠르게 판단하도록 돕는 서비스입니다.

배포 서비스: [build-the-dom.vercel.app](https://build-the-dom.vercel.app) · 저장소: [mucho7/build-the-dom](https://github.com/mucho7/build-the-dom)

## 주요 기능

- 오늘·내일·모레 KBO 경기와 구장별 직관 판단
- 기상청 단기예보 기반 강수확률·예상 강수량·경기 전 비 여부 반영
- 최근 3년 유사 날씨 경기의 우천취소 이력 반영
- 충분한 표본의 높은 취소율은 위험도 score 하한으로 적용
- 경기 `played` 상태에서는 날씨 대신 KBO 팀별 스코어 표시
- 응원팀을 브라우저에 저장하고 날짜별 해당 팀 경기를 자동 선택
- 판단 근거는 접히는 상세 표에서 확인

## 기술 구성

- Next.js 16 / React 19 / TypeScript / Tailwind CSS
- Prisma / PostgreSQL (Supabase 등)
- 기상청 API Hub 단기예보, 기상청 ASOS 시간 관측
- KBO 공식 일정, GitHub Actions, Vercel

## 로컬 실행

Node.js 20 이상과 PostgreSQL 데이터베이스가 필요합니다.

```bash
npm install
cp .env.example .env.local
npm run db:migrate
npm run dev
```

`.env.local`에는 다음 값을 입력합니다.

| 이름 | 용도 |
| --- | --- |
| `DATABASE_URL` | PostgreSQL 연결 문자열 |
| `KMA_AUTH_KEY` | 기상청 API Hub 단기예보 인증키 |
| `KMA_ASOS_SERVICE_KEY` | 최근 3년 ASOS 관측값 적재용 인증키 |
| `CRON_SECRET` | 예보 갱신 엔드포인트 보호용 비밀값 |

`KMA_ASOS_SERVICE_KEY`는 과거 이력을 적재할 때만 필요합니다.

## 데이터 적재와 갱신

```bash
# 현재 일정과 오늘·내일·모레 예보 캐시 갱신
npm run sync:weather

# KBO 과거 일정 적재
npm run sync:kbo-history

# 과거 관측 연결 확인
npm run sync:kbo-weather-history -- 1

# 최근 3년 완료 경기의 과거 관측값 전체 적재
npm run sync:kbo-weather-history
```

현재 예보는 경기별 캐시에 저장되며, 화면은 `GET /api/weather?date=YYYYMMDD`로 해당 날짜의 결과를 한 번에 읽습니다. 상세 설계와 score 정책은 [날씨 캐시 전략 문서](docs/weather-cache-strategy.md)에서 확인할 수 있습니다.

## 위험도 score 정책

기본 점수는 경기 시간대 강수확률·예상 강수량·경기 전 비 여부로 계산합니다. 완전 일치 유사 표본이 5경기 이상이면 우천취소율을 score 하한으로 사용합니다. 강수량만 일치한 표본도 5경기 이상이고 취소율이 60% 이상이면 같은 방식으로 반영합니다.

예를 들어 비슷한 조건의 6경기 중 5경기가 우천취소됐다면, 예보 점수가 낮아도 최종 score는 최소 83점입니다. 돔구장은 강수 영향이 낮은 것으로 처리합니다.

## 배포와 매시 예보 갱신

Vercel에 배포한 뒤 환경 변수 `DATABASE_URL`, `KMA_AUTH_KEY`, `KMA_ASOS_SERVICE_KEY`, `CRON_SECRET`을 설정합니다.

Vercel Hobby의 크론 제약을 보완하기 위해 GitHub Actions가 매시 17분(UTC)에 `/api/cron/weather`를 호출합니다. 저장소의 `Settings → Secrets and variables → Actions`에 아래 값을 설정하세요.

| 구분 | 이름 | 값 |
| --- | --- | --- |
| Secret | `CRON_SECRET` | Vercel의 `CRON_SECRET`과 동일한 값 |
| Variable | `VERCEL_DEPLOYMENT_URL` | 예: `https://build-the-dom.vercel.app` |

Actions 탭의 **날씨 예보 캐시 갱신** 워크플로에서 `Run workflow`를 눌러 수동 갱신도 할 수 있습니다.

## 유의 사항

- 예보와 KBO 일정 상태는 바뀔 수 있습니다. 최종 경기 진행 여부는 KBO 공식 공지가 기준입니다.
- 응원팀 설정은 로그인 계정이 아니라 현재 브라우저의 `localStorage`에만 저장됩니다.
