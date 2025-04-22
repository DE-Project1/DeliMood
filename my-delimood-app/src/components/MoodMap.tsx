import React, { useState, useEffect, useRef, useCallback } from 'react';
import { fetchAndParseCsv, LocationEntry } from '../utils/regionParser'; // 경로 확인 필요

// --- 타입 정의 ---
type MoodTagData = {
    name: string;
    frequency: number;
};

type TagWithPosition = {
    tag: MoodTagData;
    x: number;
    y: number;
    size: number; // 반지름
    color: string;
    textColor: string;
    animationDelay: string;
};

type MoodMapProps = {
    onFindRestaurants?: (location: string, tag: string) => void;
};

// --- 지역별 태그 데이터 ---
const locationTagsData: { [key: string]: MoodTagData[] } = {
    // 기존 데이터
    "연남동": [{ name: "데이트", frequency: 5 }, { name: "혼밥", frequency: 4 }, { name: "가성비", frequency: 4 }, { name: "조용한", frequency: 3 }, { name: "감성적", frequency: 3 }, { name: "신선한", frequency: 2 }, { name: "든든한", frequency: 2 }],
    "합정동": [{ name: "분위기 좋은", frequency: 5 }, { name: "활기찬", frequency: 4 }, { name: "신선한", frequency: 4 }, { name: "데이트", frequency: 3 }, { name: "빠른 식사", frequency: 3 }, { name: "특별한", frequency: 2 }, { name: "혼밥", frequency: 1 }],
    "망원동": [{ name: "든든한", frequency: 5 }, { name: "가성비", frequency: 5 }, { name: "혼밥", frequency: 4 }, { name: "편안한", frequency: 3 }, { name: "조용한", frequency: 2 }, { name: "감성적", frequency: 2 }, { name: "빠른 식사", frequency: 1 }],

    // ▼▼▼ 테스트 데이터 추가 ▼▼▼
    "청운효자동": [{ name: "조용한", frequency: 4 }, { name: "산책", frequency: 3 }, { name: "한적한", frequency: 5 }, { name: "전통", frequency: 2 }],
    "사직동": [{ name: "역사적인", frequency: 4 }, { name: "가족", frequency: 3 }, { name: "든든한", frequency: 5 }, { name: "숨은 맛집", frequency: 3 }],
    "삼청동": [{ name: "데이트", frequency: 5 }, { name: "감성적", frequency: 5 }, { name: "갤러리", frequency: 3 }, { name: "예쁜 카페", frequency: 4 }, { name: "조용한", frequency: 2 }],
    "서교동": [{ name: "활기찬", frequency: 5 }, { name: "젊은", frequency: 4 }, { name: "술 한잔", frequency: 4 }, { name: "클럽", frequency: 3 }, { name: "버스킹", frequency: 2 }],
    "익선동": [{ name: "한옥", frequency: 5 }, { name: "데이트", frequency: 5 }, { name: "골목길", frequency: 4 }, { name: "감성적", frequency: 4 }, { name: "전통주", frequency: 3 }],
    "정자동": [{ name: "카페거리", frequency: 5 }, { name: "브런치", frequency: 4 }, { name: "가족 외식", frequency: 3 }, { name: "깔끔한", frequency: 4 }], // 분당 정자동 가정
    "판교동": [{ name: "테크노밸리", frequency: 5 }, { name: "점심", frequency: 4 }, { name: "회식", frequency: 3 }, { name: "깔끔한", frequency: 4 }, { name: "가성비", frequency: 2 }],
    // ▲▲▲ 테스트 데이터 추가 끝 ▲▲▲
};


// --- 유틸리티 함수 (원형 충돌 감지) ---
const isCollidingCircles = (
    circle1: { x: number; y: number; radius: number },
    circle2: { x: number; y: number; radius: number },
    padding = 10 // 원 사이 최소 간격
): boolean => {
    const dx = circle1.x - circle2.x;
    const dy = circle1.y - circle2.y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    return distance < circle1.radius + circle2.radius + padding;
};

// --- 태그 컴포넌트 (원형 버블) ---
const MoodTag: React.FC<{
    tagData: TagWithPosition;
    isSelected: boolean;
    onClick: (tag: string) => void;
}> = React.memo(({ tagData, isSelected, onClick }) => {
    const { tag, x, y, size, color, textColor, animationDelay } = tagData;
    const diameter = size * 2; // 지름
    const fontSize = Math.max(10, size * 0.35); // 최소 10px, 크기에 비례

    const selectedStyle = isSelected
        ? 'ring-2 ring-offset-2 ring-orange-500 scale-110 shadow-xl'
        : 'hover:scale-105 active:scale-95 shadow-lg';

    return (
        <button
            type="button"
            className={`
                absolute cursor-pointer rounded-full
                ${color} ${textColor} ${selectedStyle}
                flex items-center justify-center text-center
                transition-all duration-300 ease-in-out
                animate-fade-in
            `}
            style={{
                left: `${x}px`, top: `${y}px`,
                width: `${diameter}px`, height: `${diameter}px`,
                fontSize: `${fontSize}px`,
                transform: 'translate(-50%, -50%)',
                zIndex: isSelected ? 20 + tag.frequency : 10 + tag.frequency,
                animationDelay: animationDelay,
            }}
            onClick={() => onClick(tag.name)}
            aria-pressed={isSelected}
        >
            <div className="flex flex-col items-center px-1">
                <span className="font-semibold leading-tight">{tag.name}</span>
                <span className="text-[0.7em] opacity-80 font-light">({tag.frequency})</span>
            </div>
        </button>
    );
});


// --- 메인 컴포넌트 ---
export default function MoodMap({ onFindRestaurants }: MoodMapProps) {
    // --- 상태 관리 ---
    const [regionData, setRegionData] = useState<LocationEntry[] | null>(null);
    const [isLoading, setIsLoading] = useState<boolean>(true);

    const [sidoList, setSidoList] = useState<string[]>([]);
    const [sigunguList, setSigunguList] = useState<string[]>([]);
    const [eupmyeondongList, setEupmyeondongList] = useState<string[]>([]);

    const [selectedSido, setSelectedSido] = useState<string>('');
    const [selectedSigungu, setSelectedSigungu] = useState<string>('');
    const [selectedEupmyeondong, setSelectedEupmyeondong] = useState<string>('');

    const [selectedTag, setSelectedTag] = useState<string | null>(null);
    const [tagPositions, setTagPositions] = useState<TagWithPosition[]>([]);
    const mapRef = useRef<HTMLDivElement | null>(null);

    // 색상 팔레트
    const colorPalette = [
        { bg: "bg-amber-400", text: "text-gray-800" }, { bg: "bg-rose-400", text: "text-white" },
        { bg: "bg-indigo-400", text: "text-white" }, { bg: "bg-emerald-400", text: "text-gray-800" },
        { bg: "bg-violet-400", text: "text-white" }, { bg: "bg-orange-400", text: "text-white" },
        { bg: "bg-teal-400", text: "text-gray-800" }, { bg: "bg-pink-400", text: "text-white" },
        { bg: "bg-sky-400", text: "text-white" }, { bg: "bg-lime-400", text: "text-gray-800" },
    ];

    // --- 행정구역 데이터 로딩 ---
    useEffect(() => {
        const loadRegionData = async () => {
            setIsLoading(true);
            const parsedData = await fetchAndParseCsv();
            setRegionData(parsedData);
            if (parsedData) { // parsedData가 null이 아닌지 확인
                const uniqueSidos = Array.from(new Set(parsedData.map(entry => entry.city))); // city 값 추출 및 중복 제거
                setSidoList(uniqueSidos);
                if (uniqueSidos.length > 0) {
                    setSelectedSido(uniqueSidos[0]); // 첫 번째 시/도 선택
                }
            }
            setIsLoading(false);
        };
        loadRegionData();
    }, []);

    // --- 시/군/구 목록 업데이트 ---
    useEffect(() => {
        if (regionData && selectedSido) { // regionData와 selectedSido가 유효한지 확인
            const filteredBySido = regionData.filter(entry => entry.city === selectedSido);
            const uniqueSigungus = Array.from(new Set(filteredBySido.map(entry => entry.district))); // district 값 추출 및 중복 제거
            setSigunguList(uniqueSigungus);

            if (uniqueSigungus.length > 0) {
                // 시/도가 변경되었을 때, 이전에 선택된 시군구가 새 목록에 없으면 첫 항목 선택
                setSelectedSigungu(prevSigungu => uniqueSigungus.includes(prevSigungu) ? prevSigungu : uniqueSigungus[0]);
            } else {
                setSelectedSigungu('');
                setEupmyeondongList([]);
                setSelectedEupmyeondong('');
            }
        } else {
            setSigunguList([]);
            setSelectedSigungu('');
            setEupmyeondongList([]);
            setSelectedEupmyeondong('');
        }

    }, [selectedSido, regionData]);

    // --- 읍/면/동 목록 업데이트 ---
    useEffect(() => {
        if (regionData && selectedSido && selectedSigungu) { // regionData, selectedSido, selectedSigungu 유효성 확인
            const filteredBySigungu = regionData.filter(entry => entry.city === selectedSido && entry.district === selectedSigungu);
            // neighborhood는 보통 고유하지만, 만약을 위해 Set 사용
            const uniqueEupmyeondongs = Array.from(new Set(filteredBySigungu.map(entry => entry.neighborhood)));
            setEupmyeondongList(uniqueEupmyeondongs);

            if (uniqueEupmyeondongs.length > 0) {
                // 시/군/구가 변경되었을 때, 이전에 선택된 읍면동이 새 목록에 없으면 첫 항목 선택
                setSelectedEupmyeondong(prevEup => uniqueEupmyeondongs.includes(prevEup) ? prevEup : uniqueEupmyeondongs[0]);
            } else {
                setSelectedEupmyeondong('');
            }
        } else {
            setEupmyeondongList([]);
            setSelectedEupmyeondong('');
        }
    }, [selectedSigungu, selectedSido, regionData]);


    // --- 태그 위치 계산 (원형 배치) ---
    const calculateTagPositions = useCallback(() => {
        // 초기 조건 검사 강화
        if (isLoading || !mapRef.current || !selectedEupmyeondong || !regionData) {
            setTagPositions([]);
            return;
        }

        const currentTags = locationTagsData[selectedEupmyeondong] || [];
        if (currentTags.length === 0) {
            setTagPositions([]);
            return;
        }

        const container = mapRef.current;
        const mapWidth = container.clientWidth;
        const mapHeight = container.clientHeight;
        // 컨테이너 크기가 유효하지 않으면 계산 중단
        if (mapWidth <= 0 || mapHeight <= 0) {
            console.warn("Container dimensions are invalid, skipping position calculation.");
            setTagPositions([]); // 크기가 유효하지 않으면 빈 배열 설정
            return;
        }

        const centerX = mapWidth / 2;
        const centerY = mapHeight / 2;
        const centerAvoidRadius = 80; // 중앙 회피 반지름

        const positions: TagWithPosition[] = [];
        const sortedTags = [...currentTags].sort((a, b) => b.frequency - a.frequency);

        for (const tag of sortedTags) {
            const baseRadius = 25;
            const extraRadius = tag.frequency * 5;
            const radius = baseRadius + extraRadius;

            const colorIndex = Math.floor(Math.random() * colorPalette.length);
            const { bg, text } = colorPalette[colorIndex];
            const animationDelay = `${(Math.random() * 0.5).toFixed(2)}s`;

            let attempts = 0;
            let foundPosition = false;
            let newPos: TagWithPosition | null = null;
            const maxAttempts = 150;

            while (attempts < maxAttempts && !foundPosition) {
                const angle = Math.random() * Math.PI * 2;
                const minDistance = centerAvoidRadius + radius + 10;
                // 최대 거리는 컨테이너 경계 고려
                const maxPossibleRadius = Math.min(mapWidth / 2, mapHeight / 2) - 10; // 컨테이너 경계 여백
                const maxDistance = maxPossibleRadius - radius; // 실제 배치 가능한 최대 거리

                // 배치 불가능한 경우 루프 탈출
                if (minDistance >= maxDistance) {
                    console.warn(`Tag "${tag.name}" might be too large or container too small. Cannot place within bounds.`);
                    break;
                }

                const distance = minDistance + Math.random() * (maxDistance - minDistance);
                const x = centerX + Math.cos(angle) * distance;
                const y = centerY + Math.sin(angle) * distance;

                const currentCircle = { x, y, radius };

                // 충돌 검사
                let collides = isCollidingCircles(currentCircle, { x: centerX, y: centerY, radius: centerAvoidRadius }, 0);
                if (!collides) {
                    for (const pos of positions) {
                        if (isCollidingCircles(currentCircle, { x: pos.x, y: pos.y, radius: pos.size })) {
                            collides = true;
                            break;
                        }
                    }
                }

                if (!collides) {
                    newPos = { tag, x, y, size: radius, color: bg, textColor: text, animationDelay };
                    foundPosition = true;
                }
                attempts++;
            }

            if (newPos) {
                positions.push(newPos);
            } else {
                // 실패 시 화면 밖에 배치 (또는 다른 전략)
                positions.push({
                    tag, x: -999, y: -999, size: radius,
                    color: bg, textColor: text, animationDelay: '0s'
                });
                if (attempts >= maxAttempts) {
                    console.warn(`Could not find position for tag: ${tag.name} after ${maxAttempts} attempts.`);
                }
            }
        }

        setTagPositions(positions);
        setSelectedTag(null); // 지역 변경 시 태그 선택 해제

    }, [selectedEupmyeondong, regionData, isLoading]); // 의존성 배열 확인


    // --- 핸들러 및 나머지 useEffect ---
    const handleTagClick = useCallback((tag: string) => {
        setSelectedTag(prev => (prev === tag ? null : tag));
    }, []);

    const handleFindClick = () => {
        if (selectedEupmyeondong && selectedTag && onFindRestaurants) {
            onFindRestaurants(selectedEupmyeondong, selectedTag);
            console.log(`Finding restaurants in ${selectedEupmyeondong} for mood: ${selectedTag}`);
        }
    };

    // 태그 위치 계산 트리거
    useEffect(() => {
        // mapRef.current가 유효하고 로딩이 끝난 후 계산 실행
        if (mapRef.current && !isLoading) {
            const timer = setTimeout(calculateTagPositions, 100); // 약간의 딜레이
            return () => clearTimeout(timer);
        }
    }, [calculateTagPositions, isLoading]); // isLoading 추가

    // 리사이즈 핸들러
    useEffect(() => {
        let timeoutId: NodeJS.Timeout | null = null;
        const handleResize = () => {
            if (timeoutId) clearTimeout(timeoutId);
            // 로딩 중 아닐 때만 리사이즈 시 재계산
            if (!isLoading) {
                timeoutId = setTimeout(calculateTagPositions, 300);
            }
        };
        window.addEventListener('resize', handleResize);
        return () => {
            if (timeoutId) clearTimeout(timeoutId);
            window.removeEventListener('resize', handleResize);
        };
    }, [calculateTagPositions, isLoading]); // isLoading 추가


    // --- 렌더링 ---
    return (
        <div className="flex flex-col min-h-screen bg-gray-100 text-gray-800">
            {/* --- 상단 헤더 --- */}
            <header className="sticky top-0 z-30 px-4 py-3 shadow-md bg-gradient-to-r from-orange-400 to-pink-500 text-white">
                <div className="mx-auto flex max-w-md items-center justify-center">
                    <h1 className="text-xl font-bold">DeliMood</h1>
                </div>
            </header>

            {/* --- 메인 콘텐츠 --- */}
            <main className="flex-grow flex flex-col items-center w-full px-4 pt-5 pb-28">
                {/* --- 행정구역 선택 --- */}
                <div className="w-full max-w-md mb-4 space-y-2">
                    <div className="grid grid-cols-3 gap-2">
                        {/* 시/도 */}
                        <select
                            id="sido-select"
                            value={selectedSido}
                            onChange={(e) => setSelectedSido(e.target.value)}
                            disabled={isLoading}
                            className="w-full appearance-none rounded-md border border-gray-300 bg-white py-2 px-3 text-sm focus:border-orange-500 focus:outline-none focus:ring-1 focus:ring-orange-500 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            <option value="">{isLoading ? '로딩중...' : '시/도'}</option>
                            {sidoList.map(sido => <option key={sido} value={sido}>{sido}</option>)}
                        </select>
                        {/* 시/군/구 */}
                        <select
                            id="sigungu-select"
                            value={selectedSigungu}
                            onChange={(e) => setSelectedSigungu(e.target.value)}
                            disabled={isLoading || !selectedSido}
                            className="w-full appearance-none rounded-md border border-gray-300 bg-white py-2 px-3 text-sm focus:border-orange-500 focus:outline-none focus:ring-1 focus:ring-orange-500 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            <option value="">시/군/구</option>
                            {sigunguList.map(sigungu => <option key={sigungu} value={sigungu}>{sigungu}</option>)}
                        </select>
                        {/* 읍/면/동 */}
                        <select
                            id="eupmyeondong-select"
                            value={selectedEupmyeondong}
                            onChange={(e) => setSelectedEupmyeondong(e.target.value)}
                            disabled={isLoading || !selectedSigungu}
                            className="w-full appearance-none rounded-md border border-gray-300 bg-white py-2 px-3 text-sm focus:border-orange-500 focus:outline-none focus:ring-1 focus:ring-orange-500 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            <option value="">읍/면/동</option>
                            {eupmyeondongList.map(eup => <option key={eup} value={eup}>{eup}</option>)}
                        </select>
                    </div>
                    {/* 선택된 최종 지역 표시 */}
                    {/* {selectedEupmyeondong && !isLoading && ( // 이 부분을 삭제하거나 주석 처리
                    <p className="text-center text-xs text-gray-500 pt-1">
                        선택: {selectedSido} {selectedSigungu} {selectedEupmyeondong}
                    </p>
                )} */}
                </div>

                {/* --- 안내 텍스트 --- */}
                <p className="mb-5 text-center text-base text-gray-600 h-10 flex items-center justify-center"> {/* 높이 고정 */}
                    {isLoading ? '지역 정보를 불러오는 중입니다...' :
                        selectedEupmyeondong ? (
                            <>
                                <span className="font-semibold text-orange-500">{selectedEupmyeondong}</span>에서 어떤 분위기의 맛집을 찾으세요?
                            </>
                        ) : (
                            "먼저 지역(읍/면/동)을 선택해주세요."
                        )
                    }
                </p>

                {/* --- Mood Map 영역 --- */}
                <div
                    ref={mapRef}
                    className="relative h-[450px] w-full max-w-md flex-grow rounded-lg"
                    aria-label={`${selectedEupmyeondong || '선택된 지역'} 기분 태그 맵`}
                >
                    {isLoading ? (
                        <div className="absolute inset-0 flex items-center justify-center text-gray-400">
                            <svg className="animate-spin h-5 w-5 mr-3 text-orange-500" viewBox="0 0 24 24"> {/* 스피너 추가 */}
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                            </svg>
                            지역 정보 로딩 중...
                        </div>
                    ) : (
                        <>
                            {/* 중앙 지역명 텍스트 */}
                            {selectedEupmyeondong && (
                                // ▼▼▼ 이 div에 패딩 추가 ▼▼▼   
                                <div className="absolute left-1/2 top-1/2 z-0 -translate-x-1/2 -translate-y-1/2 transform text-center pointer-events-none px-4">
                                    {/* ▼▼▼ 이 span에 whitespace-nowrap 추가 ▼▼▼ */}
                                    <span className="text-6xl font-extrabold text-gray-200 opacity-70 select-none whitespace-nowrap">
                                        {selectedEupmyeondong}
                                    </span>
                                </div>
                            )}
                            {/* Mood 태그들 */}
                            {tagPositions.map((item) => (
                                <MoodTag
                                    key={`${selectedEupmyeondong}-${item.tag.name}`}
                                    tagData={item}
                                    isSelected={selectedTag === item.tag.name}
                                    onClick={handleTagClick}
                                />
                            ))}
                            {/* 지역 미선택 또는 태그 없을 시 안내 */}
                            {(!selectedEupmyeondong || (tagPositions.length === 0 && (locationTagsData[selectedEupmyeondong] || []).length === 0)) && (
                                // ▼▼▼ 이 div의 클래스 수정 ▼▼▼
                                <div className="absolute inset-0 flex items-start justify-center text-gray-400 text-center p-4 pt-40"> {/* items-center -> items-start, pt 추가 */}
                                    {!selectedEupmyeondong ? "먼저 지역(읍/면/동)을 선택해주세요." : "선택된 지역에는 아직 데이터가 없어요. 😅"}
                                </div>
                            )}
                        </>
                    )}
                </div>
            </main>

            {/* --- 하단 버튼 --- */}
            <div className="fixed bottom-0 left-0 right-0 z-20 bg-white p-4 shadow-[0_-2px_6px_rgba(0,0,0,0.08)]">
                <div className="mx-auto max-w-md">
                    <button
                        type="button"
                        className={`w-full rounded-full py-3 font-bold text-white transition-all duration-300 ease-in-out
                                    ${selectedTag && selectedEupmyeondong
                                ? 'bg-orange-500 hover:bg-orange-600 active:scale-[0.98]'
                                : 'bg-gray-300 cursor-not-allowed'
                            }`}
                        onClick={handleFindClick}
                        disabled={!selectedTag || !selectedEupmyeondong || isLoading} // 로딩 중에도 비활성화
                    >
                        {isLoading ? '로딩 중...' :
                            selectedTag && selectedEupmyeondong ? `'${selectedTag}' 맛집 찾기` : '지역과 기분 태그를 선택하세요'
                        }
                    </button>
                </div>
            </div>
        </div>
    );
}

// --- Tailwind 설정 추가 (tailwind.config.js) ---
/*
module.exports = {
  // ... 다른 설정들
  theme: {
    extend: {
      keyframes: {
        'fade-in': {
          '0%': { opacity: '0', transform: 'translate(-50%, -50%) scale(0.8)' },
          '100%': { opacity: '1', transform: 'translate(-50%, -50%) scale(1)' },
        }
      },
      animation: {
        'fade-in': 'fade-in 0.5s ease-out forwards',
      }
    },
  },
  plugins: [],
}
*/
