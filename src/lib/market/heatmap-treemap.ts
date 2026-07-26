import { hierarchy, treemap, treemapSquarify } from "d3-hierarchy";
import type { HierarchyNode } from "d3-hierarchy";
import type { HeatmapStock } from "@/types/market";
import { getStockMetadata } from "@/lib/market/sp500-metadata";

export interface TreemapRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface HeatmapSectorLayout extends TreemapRect {
  name: string;
}

export interface HeatmapStockLayout extends TreemapRect {
  stock: HeatmapStock;
}

export interface HeatmapLayout {
  width: number;
  height: number;
  sectors: HeatmapSectorLayout[];
  stocks: HeatmapStockLayout[];
}

interface TreemapStockNode {
  name: string;
  value: number;
  stock: HeatmapStock;
}

interface TreemapSectorNode {
  name: string;
  children: TreemapStockNode[];
}

interface TreemapRootNode {
  name: string;
  children: TreemapSectorNode[];
}

type TreemapNode = TreemapRootNode | TreemapSectorNode | TreemapStockNode;

function isStockNode(node: TreemapNode): node is TreemapStockNode {
  return "stock" in node && "value" in node;
}

function buildSectorGroups(stocks: HeatmapStock[]): TreemapSectorNode[] {
  const sectorMap = new Map<string, HeatmapStock[]>();

  for (const stock of stocks) {
    const sector = stock.sector || getStockMetadata(stock.symbol).sector;
    if (!sectorMap.has(sector)) {
      sectorMap.set(sector, []);
    }
    sectorMap.get(sector)!.push(stock);
  }

  return [...sectorMap.entries()]
    .map(([name, sectorStocks]) => ({
      name,
      children: sectorStocks
        .sort((a, b) => b.marketCap - a.marketCap)
        .map((stock) => ({
          name: stock.symbol,
          value: stock.marketCap,
          stock,
        })),
    }))
    .sort(
      (a, b) =>
        b.children.reduce((sum, item) => sum + item.value, 0) -
        a.children.reduce((sum, item) => sum + item.value, 0),
    );
}

function nodeValue(node: TreemapNode): number {
  return isStockNode(node) ? node.value : 0;
}

export function buildHeatmapLayout(
  stocks: HeatmapStock[],
  width: number,
  height: number,
): HeatmapLayout {
  if (stocks.length === 0 || width <= 0 || height <= 0) {
    return { width, height, sectors: [], stocks: [] };
  }

  const rootData: TreemapRootNode = {
    name: "root",
    children: buildSectorGroups(stocks),
  };

  const root = hierarchy<TreemapNode>(rootData)
    .sum((node) => nodeValue(node))
    .sort((a, b) => (b.value ?? 0) - (a.value ?? 0));

  treemap<TreemapNode>()
    .tile(treemapSquarify)
    .size([width, height])
    .paddingOuter(3)
    .paddingTop((node) => (node.depth === 1 ? 22 : 0))
    .paddingInner(2)
    .round(true)(root);

  const sectors: HeatmapSectorLayout[] =
    root.children?.map((node) => ({
      ...rectFromNode(node),
      name: node.data.name ?? "Other",
    })) ?? [];

  const stockRects: HeatmapStockLayout[] = root
    .leaves()
    .filter((node) => isStockNode(node.data))
    .map((node) => ({
      ...rectFromNode(node),
      stock: (node.data as TreemapStockNode).stock,
    }));

  return { width, height, sectors, stocks: stockRects };
}

type TreemapLayoutNode = HierarchyNode<TreemapNode> & {
  x0?: number;
  y0?: number;
  x1?: number;
  y1?: number;
};

function rectFromNode(
  node: TreemapLayoutNode,
  name?: string,
): TreemapRect & { name?: string } {
  const x = node.x0 ?? 0;
  const y = node.y0 ?? 0;
  return {
    name,
    x,
    y,
    width: Math.max(0, (node.x1 ?? 0) - x),
    height: Math.max(0, (node.y1 ?? 0) - y),
  };
}

export type TileLabelLayout = "hidden" | "symbol" | "full";

export function getTileLabelStyle(width: number, height: number): {
  layout: TileLabelLayout;
  symbolSize: number;
  changeSize: number;
} {
  const area = width * height;
  const minDim = Math.min(width, height);

  if (area < 56 || minDim < 11) {
    return { layout: "hidden", symbolSize: 0, changeSize: 0 };
  }

  if (area < 120 || minDim < 16) {
    return { layout: "symbol", symbolSize: 9, changeSize: 0 };
  }

  const canShowChange = width >= 26 && height >= 20 && area >= 130;

  if (!canShowChange) {
    return {
      layout: "symbol",
      symbolSize: Math.min(11, Math.max(10, Math.floor(minDim / 2.6))),
      changeSize: 0,
    };
  }

  if (area >= 2200 || minDim >= 70) {
    return { layout: "full", symbolSize: 17, changeSize: 14 };
  }

  if (area >= 900 || minDim >= 45) {
    return { layout: "full", symbolSize: 14, changeSize: 12 };
  }

  return { layout: "full", symbolSize: 11, changeSize: 10 };
}
