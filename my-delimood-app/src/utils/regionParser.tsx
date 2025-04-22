import Papa from 'papaparse';

// 각 행의 데이터를 담을 타입
export interface LocationEntry {
    adm_dong_code: string;
    city: string;
    district: string;
    neighborhood: string;
}

// 파싱 함수의 반환 타입을 LocationEntry 배열로 변경
export async function fetchAndParseCsv(): Promise<LocationEntry[]> {
    try {
        const response = await fetch('/adm_dong_list.csv'); // public 폴더에 CSV 파일 위치 가정
        if (!response.ok) {
            throw new Error(`Failed to fetch CSV: ${response.statusText}`);
        }
        const csvText = await response.text();

        // Papa.parse의 제네릭 타입을 LocationEntry로 지정 (또는 파싱 결과에서 직접 매핑)
        const result = Papa.parse<LocationEntry>(csvText, {
            header: true,        // 첫 줄을 헤더로 사용
            skipEmptyLines: true,
            dynamicTyping: false, // 모든 값을 문자열로 유지 (코드 등이 숫자로 변환되는 것 방지)
            transformHeader: header => header.trim() // 헤더 공백 제거
        });

        if (result.errors.length > 0) {
            console.error("CSV parsing errors:", result.errors);
            // 필요하다면 일부 에러는 무시하고 진행하거나, 에러 발생 시 빈 배열 반환 결정
        }

        // 데이터 유효성 검사 및 필터링 (필요시)
        const validData = result.data.filter(row =>
            row.adm_dong_code && row.city && row.district && row.neighborhood
        );

        // console.log("Parsed Location Data:", validData); // 파싱 결과 확인용 로그
        return validData;

    } catch (error) {
        console.error("Error fetching or parsing CSV:", error);
        return []; // 오류 발생 시 빈 배열 반환
    }
}
