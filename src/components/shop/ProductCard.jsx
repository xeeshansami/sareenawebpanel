import { Link } from 'react-router-dom';
import { money } from '../../utils/format.js';
import { useConsumer } from '../../context/ConsumerContext.jsx';

/** How a stock band reads to a shopper. Never a number — see routes/public.js. */
export const STOCK_LABEL = {
  in_stock: { text: 'In stock', tone: 'badge-green' },
  low_stock: { text: 'Only a few left', tone: 'badge-orange' },
  out_of_stock: { text: 'Out of stock', tone: 'badge-gray' },
};

export function StockBadge({ status }) {
  const s = STOCK_LABEL[status] || STOCK_LABEL.out_of_stock;
  return <span className={`badge ${s.tone}`}>{s.text}</span>;
}

export default function ProductCard({ product, onAdd, busy }) {
  const { quantityOf } = useConsumer();
  const inCart = quantityOf(product.id);
  const soldOut = product.stockStatus === 'out_of_stock';

  return (
    <article className="pcard">
      <Link to={`/product/${product.id}`} className="pcard-media">
        {product.imageUrl
          ? <img src={product.imageUrl} alt={product.name} loading="lazy" />
          : <span className="pcard-placeholder" aria-hidden>▣</span>}
      </Link>

      <div className="pcard-body">
        <div className="pcard-meta">
          {product.brand && <span className="badge badge-gray">{product.brand}</span>}
          {product.technology && <span className="badge badge-gray">{product.technology}</span>}
        </div>

        <Link to={`/product/${product.id}`} className="pcard-name">{product.name}</Link>

        {product.shop && (
          <div className="small muted">
            {product.shop.name}{product.shop.city ? ` · ${product.shop.city}` : ''}
          </div>
        )}

        <div className="pcard-foot">
          <div>
            {/* The sale price, and nothing else. There is no cost field in this
                payload to accidentally render. */}
            <div className="pcard-price">{money(product.price)}</div>
            <StockBadge status={product.stockStatus} />
          </div>

          <button
            className={`btn btn-sm ${inCart ? 'btn-ghost' : 'btn-primary'}`}
            disabled={soldOut || busy}
            onClick={() => onAdd(product, inCart + 1)}
            title={soldOut ? 'This shop has none left' : 'Add to cart'}
          >
            {soldOut ? 'Sold out' : inCart ? `In cart · ${inCart}` : 'Add'}
          </button>
        </div>
      </div>
    </article>
  );
}
