# 우취될까?

KBO 경기를 고르면 오늘·내일·모레의 기상청 예보와 우천취소 이력을 바탕으로 직관하기 좋은 날인지 알려주는 서비스입니다.

## 로컬 실행

```bash
npm install
cp .env.example .env.local
npm run dev
```

`.env.local`에 PostgreSQL 연결 정보와 기상청 단기예보 키(`KMA_AUTH_KEY`)를 입력한 뒤, 현재 예보 캐시를 채웁니다.

```bash
npm run db:migrate
npm run sync:weather
```

## 비슷한 날씨 기반 우천취소 이력

현재 경기의 `예상 강수량`과 `경기 전 6시간 내 비 여부`가 모두 같은 과거 경기만 비교합니다. 화면에는 다음처럼 표시됩니다.

> 최근 3년간 예상 강수량과 경기 전 비가 비슷했던 12경기 중 3경기가 우천취소됐어요.

과거 기상은 단기예보 API로 되돌려 받을 수 없으므로, 공공데이터포털의 **기상청 지상(종관, ASOS) 시간자료 조회서비스**를 별도로 신청해 인증키를 발급받아야 합니다. 발급받은 키를 `.env.local`의 `KMA_ASOS_SERVICE_KEY`에 입력한 뒤 아래 명령을 실행합니다.

```bash
# 한 경기로 연결 확인
npm run sync:kbo-weather-history -- 1

# 최근 3년 완료 경기 전체 적재
npm run sync:kbo-weather-history
```

과거 관측값은 구장별 가장 가까운 ASOS 관측소의 경기 시작 시각 및 직전 6시간 자료를 사용합니다. 이력 적재가 끝나기 전에는 비슷한 날씨 통계 문구를 표시하지 않습니다.

## Vercel Hobby 배포와 예보 갱신

Vercel Hobby는 시간 단위 크론을 지원하지 않으므로, 예보 캐시는 GitHub Actions가 매시 17분(UTC)에 갱신합니다. Vercel 배포 후 GitHub 저장소의 `Settings → Secrets and variables → Actions`에 다음을 추가합니다.

| 구분 | 이름 | 값 |
| --- | --- | --- |
| Secret | `CRON_SECRET` | Vercel의 `CRON_SECRET`과 같은 값 |
| Variable | `VERCEL_DEPLOYMENT_URL` | `https://프로젝트명.vercel.app` |

Actions 탭의 **날씨 예보 캐시 갱신** 워크플로에서 `Run workflow`를 눌러 즉시 한 번 실행할 수 있습니다. 예약 실행은 GitHub의 부하에 따라 약간 늦어질 수 있습니다.
