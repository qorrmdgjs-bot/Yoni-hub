// 까르띠에 재고 감시 대상 상품 (단일 상품 전용)
// 상품 URL은 fetch 안정성을 위해 퍼센트 인코딩된 형태를 사용한다.

export const CARTIER_PRODUCT = {
  pid: 'CRB6040300',
  name: '까르띠에 다무르 브레이슬릿, 브릴리언트 컷 다이아몬드 스몰(small) 모델',
  price: '₩2,150,000',
  url:
    'https://www.cartier.com/ko-kr/%EC%A3%BC%EC%96%BC%EB%A6%AC/%EB%B8%8C%EB%A0%88%EC%9D%B4%EC%8A%AC%EB%A6%BF/%EB%8B%A4%EC%9D%B4%EC%95%84%EB%AA%AC%EB%93%9C-%EC%BB%AC%EB%A0%89%EC%85%98/%EA%B9%8C%EB%A5%B4%EB%9D%A0%EC%97%90-%EB%8B%A4%EB%AC%B4%EB%A5%B4-%EB%B8%8C%EB%A0%88%EC%9D%B4%EC%8A%AC%EB%A6%BF-%EB%B8%8C%EB%A6%B4%EB%A6%AC%EC%96%B8%ED%8A%B8-%EC%BB%B7-%EB%8B%A4%EC%9D%B4%EC%95%84%EB%AA%AC%EB%93%9C-%EC%8A%A4%EB%AA%B0%28small%29-%EB%AA%A8%EB%8D%B8-CRB6040300.html',
  image:
    'https://www.cartier.com/dw/image/v2/BGTJ_PRD/on/demandware.static/-/Sites-cartier-master/default/dwfef66321/images/large/3a6df11b7c8e56d48e6f814b7e18975c.png?sw=600&sh=315',
} as const;

export type StockStatus = 'in_stock' | 'out_of_stock' | 'unknown';

export const STATUS_LABEL: Record<StockStatus, string> = {
  in_stock: '재고 있음',
  out_of_stock: '품절 (온라인 구매 불가)',
  unknown: '확인 필요',
};
