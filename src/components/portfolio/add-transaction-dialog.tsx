"use client";

import { useEffect, useMemo, useState } from "react";
import {
  ArrowDownLeft,
  ArrowUpRight,
  Banknote,
  Bitcoin,
  Loader2,
  PenLine,
  Plus,
  Search,
  TrendingUp,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAssetPrice } from "@/hooks/use-asset-price";
import { useAssetSearch } from "@/hooks/use-asset-search";
import { AssetLogo } from "@/components/portfolio/asset-logo";
import { SectorSelect } from "@/components/portfolio/sector-select";
import { formatPrice, formatQuantity } from "@/lib/portfolio/format";
import {
  getDefaultSectorForType,
  resolveSectorChoice,
  SECTOR_CASH,
  suggestSectorFromCatalog,
} from "@/lib/portfolio/sectors";
import {
  getTodayDateString,
  validateTransactionQuantity,
} from "@/lib/portfolio/transactions";
import { cn } from "@/lib/utils";
import {
  DISPLAY_CURRENCIES,
  getCurrencyMeta,
  getCurrencySymbol,
  type DisplayCurrency,
} from "@/types/currency";
import type {
  AddTransactionInput,
  AssetCatalogItem,
  AssetType,
  PortfolioHolding,
  TransactionType,
} from "@/types/portfolio";
import { getCashCurrency } from "@/types/portfolio";

type DialogMode = AssetType;

interface AddTransactionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAdd: (input: AddTransactionInput) => void;
  holdings: PortfolioHolding[];
}

export function AddTransactionDialog({
  open,
  onOpenChange,
  onAdd,
  holdings,
}: AddTransactionDialogProps) {
  const [mode, setMode] = useState<DialogMode>("stock");
  const [query, setQuery] = useState("");
  const [selectedAsset, setSelectedAsset] = useState<AssetCatalogItem | null>(
    null,
  );
  const [transactionType, setTransactionType] = useState<TransactionType>("buy");
  const [quantity, setQuantity] = useState("");
  const [pricePerUnit, setPricePerUnit] = useState("");
  const [date, setDate] = useState(getTodayDateString);
  const [showResults, setShowResults] = useState(false);
  const [priceTouched, setPriceTouched] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const [customSymbol, setCustomSymbol] = useState("");
  const [customName, setCustomName] = useState("");
  const [customCurrentPrice, setCustomCurrentPrice] = useState("");

  const [cashCurrency, setCashCurrency] = useState<DisplayCurrency>("USD");

  const [sectorChoice, setSectorChoice] = useState(() =>
    getDefaultSectorForType("stock"),
  );
  const [customSector, setCustomSector] = useState("");

  const isSearchMode = mode === "stock" || mode === "crypto";
  const resolvedSector = resolveSectorChoice(sectorChoice, customSector);

  const existingHolding = useMemo(() => {
    if (mode === "cash") {
      return holdings.find(
        (h) =>
          h.type === "cash" && getCashCurrency(h) === cashCurrency,
      );
    }
    if (mode === "custom") {
      const symbol = customSymbol.trim().toUpperCase();
      if (!symbol) return undefined;
      return holdings.find(
        (h) => h.type === "custom" && h.symbol === symbol,
      );
    }
    if (!selectedAsset) return undefined;
    return holdings.find(
      (h) =>
        h.symbol === selectedAsset.symbol.toUpperCase() &&
        h.type === selectedAsset.type,
    );
  }, [holdings, mode, selectedAsset, customSymbol, cashCurrency]);

  const isNewAsset = !existingHolding;

  const { results, isSearching, error: searchError } = useAssetSearch(
    query,
    mode === "stock" || mode === "crypto" ? mode : "stock",
    isSearchMode && showResults && !selectedAsset && query.trim().length > 0,
  );

  const { price: livePrice, isLoading: isPriceLoading, error: priceError } =
    useAssetPrice(isSearchMode ? selectedAsset : null);

  useEffect(() => {
    if (!open) resetForm();
  }, [open]);

  useEffect(() => {
    resetFields();
    setSectorChoice(getDefaultSectorForType(mode));
    setCustomSector("");
    setTransactionType("buy");
  }, [mode]);

  useEffect(() => {
    if (livePrice !== null && !priceTouched && isSearchMode && transactionType === "buy") {
      setPricePerUnit(livePrice.toString());
    }
  }, [livePrice, priceTouched, isSearchMode, transactionType]);

  useEffect(() => {
    setSubmitError(null);
  }, [transactionType, quantity, pricePerUnit, selectedAsset, customSymbol]);

  function resetFields() {
    setQuery("");
    setSelectedAsset(null);
    setTransactionType("buy");
    setQuantity("");
    setPricePerUnit("");
    setDate(getTodayDateString());
    setShowResults(false);
    setPriceTouched(false);
    setSubmitError(null);
    setCustomSymbol("");
    setCustomName("");
    setCustomCurrentPrice("");
    setCashCurrency("USD");
  }

  function resetForm() {
    setMode("stock");
    resetFields();
  }

  const handleSelectAsset = (asset: AssetCatalogItem) => {
    setSelectedAsset(asset);
    setQuery(asset.symbol);
    setShowResults(false);
    setPricePerUnit("");
    setPriceTouched(false);
    setTransactionType("buy");

    const suggested = suggestSectorFromCatalog(asset);
    setSectorChoice(suggested);
    setCustomSector("");
  };

  const buildInput = (): AddTransactionInput | null => {
    const parsedQty = parseFloat(quantity);
    const parsedPrice = mode === "cash" ? 1 : parseFloat(pricePerUnit);

    if (!parsedQty || parsedQty <= 0) return null;
    if (mode !== "cash" && (!parsedPrice || parsedPrice <= 0)) return null;
    if (!date) return null;

    const qtyError = validateTransactionQuantity(
      existingHolding,
      transactionType,
      parsedQty,
    );
    if (qtyError) {
      setSubmitError(qtyError);
      return null;
    }

    if (isSearchMode) {
      if (!selectedAsset) return null;
      if (isNewAsset && !resolvedSector) return null;

      return {
        asset: selectedAsset,
        type: transactionType,
        quantity: parsedQty,
        pricePerUnit: parsedPrice,
        date,
        sector: isNewAsset ? resolvedSector! : undefined,
      };
    }

    if (mode === "custom") {
      const symbol = customSymbol.trim().toUpperCase();
      if (!symbol) return null;
      if (isNewAsset) {
        const parsedCurrent = parseFloat(customCurrentPrice);
        if (!parsedCurrent || parsedCurrent <= 0 || !resolvedSector) return null;
      }

      return {
        asset: {
          symbol,
          name: customName.trim() || symbol,
          type: "custom",
          category: "Custom",
          subCategory: "Manual",
        },
        type: transactionType,
        quantity: parsedQty,
        pricePerUnit: parsedPrice,
        date,
        sector: isNewAsset ? resolvedSector! : undefined,
        manualCurrentPrice: isNewAsset
          ? parseFloat(customCurrentPrice)
          : undefined,
      };
    }

    if (mode === "cash") {
      return {
        asset: {
          symbol: "CASH",
          name: `Cash (${cashCurrency})`,
          type: "cash",
          category: "Cash",
          subCategory: "Liquidity",
        },
        type: transactionType,
        quantity: parsedQty,
        pricePerUnit: 1,
        date,
        sector: isNewAsset ? SECTOR_CASH : undefined,
        cashCurrency,
      };
    }

    return null;
  };

  const handleSubmit = () => {
    const input = buildInput();
    if (!input) return;
    onAdd(input);
    onOpenChange(false);
  };

  const parsedQty = parseFloat(quantity);
  const parsedPrice = mode === "cash" ? 1 : parseFloat(pricePerUnit);

  const isSearchValid =
    selectedAsset &&
    parsedQty > 0 &&
    parsedPrice > 0 &&
    !!date &&
    (isNewAsset && transactionType === "buy" ? !!resolvedSector : true) &&
    !validateTransactionQuantity(existingHolding, transactionType, parsedQty) &&
    !(transactionType === "buy" && isPriceLoading);

  const isCustomValid =
    customSymbol.trim().length > 0 &&
    parsedQty > 0 &&
    parsedPrice > 0 &&
    !!date &&
    (isNewAsset
      ? !!resolvedSector && parseFloat(customCurrentPrice) > 0
      : true) &&
    !validateTransactionQuantity(existingHolding, transactionType, parsedQty);

  const isCashValid =
    parsedQty > 0 &&
    !!date &&
    !validateTransactionQuantity(existingHolding, transactionType, parsedQty);

  const isValid =
    mode === "custom"
      ? isCustomValid
      : mode === "cash"
        ? isCashValid
        : isSearchValid;

  const showDropdown =
    isSearchMode && showResults && !selectedAsset && query.trim().length > 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add Transaction</DialogTitle>
          <DialogDescription>
            Record a buy or sell to update quantity and average cost automatically.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 py-2">
          <Tabs
            value={mode}
            onValueChange={(value) => setMode(value as DialogMode)}
          >
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="stock" className="gap-1.5 px-2">
                <TrendingUp className="size-3.5" />
                Stocks
              </TabsTrigger>
              <TabsTrigger value="crypto" className="gap-1.5 px-2">
                <Bitcoin className="size-3.5" />
                Crypto
              </TabsTrigger>
              <TabsTrigger value="custom" className="gap-1.5 px-2">
                <PenLine className="size-3.5" />
                Custom
              </TabsTrigger>
              <TabsTrigger value="cash" className="gap-1.5 px-2">
                <Banknote className="size-3.5" />
                Cash
              </TabsTrigger>
            </TabsList>
          </Tabs>

          <TransactionTypeToggle
            value={transactionType}
            onChange={setTransactionType}
          />

          {isSearchMode && (
            <>
              {isNewAsset && (
                <SectorSelect
                  assetType={mode}
                  sectorChoice={sectorChoice}
                  customSector={customSector}
                  onSectorChoiceChange={setSectorChoice}
                  onCustomSectorChange={setCustomSector}
                  idPrefix="tx-search"
                />
              )}

              <div className="space-y-2">
                <Label htmlFor="asset-search">Asset</Label>
                <div className="relative">
                  <Search className="absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="asset-search"
                    placeholder={
                      mode === "stock"
                        ? "Search ticker, e.g. AAPL, TSLA"
                        : "Search symbol, e.g. BTC, ETH"
                    }
                    value={query}
                    onChange={(e) => {
                      setQuery(e.target.value.toUpperCase());
                      setSelectedAsset(null);
                      setShowResults(true);
                    }}
                    onFocus={() => setShowResults(true)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && results[0] && !selectedAsset) {
                        e.preventDefault();
                        handleSelectAsset(results[0]);
                      }
                    }}
                    className="pl-9"
                    autoComplete="off"
                  />
                  {showDropdown && (
                    <div className="absolute z-10 mt-1 w-full overflow-hidden rounded-lg border bg-popover shadow-md">
                      {isSearching ? (
                        <div className="flex items-center gap-2 px-3 py-3 text-sm text-muted-foreground">
                          <Loader2 className="size-4 animate-spin" />
                          Searching…
                        </div>
                      ) : searchError ? (
                        <div className="px-3 py-3 text-sm text-destructive">
                          {searchError}
                        </div>
                      ) : results.length > 0 ? (
                        results.map((asset) => (
                          <button
                            key={`${asset.symbol}-${asset.priceId ?? asset.type}`}
                            type="button"
                            onClick={() => handleSelectAsset(asset)}
                            className="flex w-full items-center gap-3 px-3 py-2.5 text-left text-sm transition-colors hover:bg-muted"
                          >
                            <AssetLogo
                              symbol={asset.symbol}
                              name={asset.name}
                              type={asset.type}
                              logoUrl={asset.logoUrl}
                              priceId={asset.priceId}
                              size="sm"
                            />
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2">
                                <span className="font-semibold">
                                  {asset.symbol}
                                </span>
                                <span className="truncate text-muted-foreground">
                                  {asset.name}
                                </span>
                              </div>
                            </div>
                          </button>
                        ))
                      ) : (
                        <div className="px-3 py-3 text-sm text-muted-foreground">
                          No results for &quot;{query.trim().toUpperCase()}&quot;.
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {selectedAsset && (
                <TransactionFormFields
                  asset={selectedAsset}
                  existingHolding={existingHolding}
                  transactionType={transactionType}
                  quantity={quantity}
                  pricePerUnit={pricePerUnit}
                  date={date}
                  isPriceLoading={isPriceLoading}
                  priceError={priceError}
                  livePrice={livePrice}
                  hidePrice={false}
                  onQuantityChange={setQuantity}
                  onPricePerUnitChange={(value) => {
                    setPricePerUnit(value);
                    setPriceTouched(true);
                  }}
                  onDateChange={setDate}
                />
              )}
            </>
          )}

          {mode === "custom" && (
            <div className="space-y-4 rounded-xl border border-border/70 bg-muted/20 p-4">
              {isNewAsset && (
                <SectorSelect
                  assetType="custom"
                  sectorChoice={sectorChoice}
                  customSector={customSector}
                  onSectorChoiceChange={setSectorChoice}
                  onCustomSectorChange={setCustomSector}
                  idPrefix="tx-custom"
                />
              )}
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="custom-symbol">Ticker / Symbol</Label>
                  <Input
                    id="custom-symbol"
                    placeholder="e.g. GOLD"
                    value={customSymbol}
                    onChange={(e) =>
                      setCustomSymbol(e.target.value.toUpperCase())
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="custom-name">Name (optional)</Label>
                  <Input
                    id="custom-name"
                    placeholder="Asset name"
                    value={customName}
                    onChange={(e) => setCustomName(e.target.value)}
                  />
                </div>
              </div>
              {isNewAsset && (
                <div className="space-y-2">
                  <Label htmlFor="custom-current-price">
                    Current Price (USD)
                  </Label>
                  <Input
                    id="custom-current-price"
                    type="number"
                    min="0"
                    step="any"
                    placeholder="0.00"
                    value={customCurrentPrice}
                    onChange={(e) => setCustomCurrentPrice(e.target.value)}
                  />
                </div>
              )}
              <TransactionFormFields
                transactionType={transactionType}
                quantity={quantity}
                pricePerUnit={pricePerUnit}
                date={date}
                existingHolding={existingHolding}
                hidePrice={false}
                onQuantityChange={setQuantity}
                onPricePerUnitChange={setPricePerUnit}
                onDateChange={setDate}
              />
            </div>
          )}

          {mode === "cash" && (
            <div className="space-y-4 rounded-lg border bg-muted/30 p-4">
              <div className="space-y-2">
                <Label htmlFor="cash-currency">Currency</Label>
                <Select
                  value={cashCurrency}
                  onValueChange={(value) => {
                    if (value) setCashCurrency(value as DisplayCurrency);
                  }}
                >
                  <SelectTrigger id="cash-currency" className="w-full">
                    <SelectValue placeholder="Select currency" />
                  </SelectTrigger>
                  <SelectContent>
                    {DISPLAY_CURRENCIES.map((code) => (
                      <SelectItem key={code} value={code}>
                        <span className="flex items-center gap-2">
                          <span className="text-muted-foreground">
                            {getCurrencySymbol(code)}
                          </span>
                          <span className="font-medium">{code}</span>
                          <span className="text-muted-foreground">
                            {getCurrencyMeta(code).name}
                          </span>
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <TransactionFormFields
                transactionType={transactionType}
                quantity={quantity}
                pricePerUnit="1"
                date={date}
                existingHolding={existingHolding}
                hidePrice
                onQuantityChange={setQuantity}
                onPricePerUnitChange={() => {}}
                onDateChange={setDate}
              />
            </div>
          )}

          {submitError && (
            <p className="text-sm text-destructive">{submitError}</p>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={!isValid} className="gap-2">
            {isSearchMode && isPriceLoading ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Plus className="size-4" />
            )}
            Add Transaction
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function TransactionTypeToggle({
  value,
  onChange,
}: {
  value: TransactionType;
  onChange: (value: TransactionType) => void;
}) {
  return (
    <div className="space-y-2">
      <Label>Transaction Type</Label>
      <div className="grid grid-cols-2 gap-2 rounded-xl bg-muted/40 p-1">
        <button
          type="button"
          onClick={() => onChange("buy")}
          className={cn(
            "flex items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
            value === "buy"
              ? "bg-background text-foreground shadow-sm ring-1 ring-border/60"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          <ArrowDownLeft className="size-4 text-emerald-600 dark:text-emerald-400" />
          Buy
        </button>
        <button
          type="button"
          onClick={() => onChange("sell")}
          className={cn(
            "flex items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
            value === "sell"
              ? "bg-background text-foreground shadow-sm ring-1 ring-border/60"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          <ArrowUpRight className="size-4 text-red-600 dark:text-red-400" />
          Sell
        </button>
      </div>
    </div>
  );
}

function TransactionFormFields({
  asset,
  existingHolding,
  transactionType,
  quantity,
  pricePerUnit,
  date,
  isPriceLoading,
  priceError,
  livePrice,
  hidePrice,
  onQuantityChange,
  onPricePerUnitChange,
  onDateChange,
}: {
  asset?: AssetCatalogItem;
  existingHolding?: PortfolioHolding;
  transactionType: TransactionType;
  quantity: string;
  pricePerUnit: string;
  date: string;
  isPriceLoading?: boolean;
  priceError?: string | null;
  livePrice?: number | null;
  hidePrice?: boolean;
  onQuantityChange: (value: string) => void;
  onPricePerUnitChange: (value: string) => void;
  onDateChange: (value: string) => void;
}) {
  return (
    <div className="space-y-4">
      {asset && (
        <div className="flex items-center gap-3 rounded-lg border bg-muted/30 px-3 py-2.5">
          <AssetLogo
            symbol={asset.symbol}
            name={asset.name}
            type={asset.type}
            logoUrl={asset.logoUrl}
            priceId={asset.priceId}
            size="sm"
          />
          <div className="min-w-0 flex-1">
            <p className="font-semibold">{asset.symbol}</p>
            <p className="truncate text-xs text-muted-foreground">
              {asset.name}
            </p>
          </div>
        </div>
      )}

      {existingHolding && existingHolding.quantity > 0 && (
        <div className="rounded-lg border border-border/60 bg-background px-3 py-2.5 text-sm">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Current Position
          </p>
          <p className="mt-1 tabular-nums">
            {formatQuantity(existingHolding.quantity, existingHolding.type)} @{" "}
            {formatPrice(
              existingHolding.costPrice,
              existingHolding.type,
            )}{" "}
            avg
          </p>
        </div>
      )}

      {asset && transactionType === "buy" && livePrice !== undefined && (
        <div className="rounded-md border bg-background px-3 py-2">
          <p className="text-xs font-medium text-muted-foreground">
            Live Market Price
          </p>
          {isPriceLoading ? (
            <div className="mt-1 flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" />
              Fetching…
            </div>
          ) : priceError ? (
            <p className="mt-1 text-sm text-destructive">{priceError}</p>
          ) : livePrice !== null ? (
            <p className="mt-1 text-lg font-semibold tabular-nums">
              {formatPrice(livePrice, asset.type)}
            </p>
          ) : null}
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="tx-quantity">Quantity</Label>
          <Input
            id="tx-quantity"
            type="number"
            min="0"
            step="any"
            placeholder="0"
            value={quantity}
            onChange={(e) => onQuantityChange(e.target.value)}
          />
        </div>
        {!hidePrice && (
          <div className="space-y-2">
            <Label htmlFor="tx-price">
              {transactionType === "buy" ? "Price per unit" : "Sell price per unit"}
            </Label>
            <Input
              id="tx-price"
              type="number"
              min="0"
              step="any"
              placeholder={isPriceLoading ? "Loading…" : "0.00"}
              value={pricePerUnit}
              onChange={(e) => onPricePerUnitChange(e.target.value)}
              disabled={isPriceLoading}
            />
          </div>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="tx-date">Date</Label>
        <Input
          id="tx-date"
          type="date"
          value={date}
          onChange={(e) => onDateChange(e.target.value)}
        />
      </div>
    </div>
  );
}

interface AddTransactionButtonProps {
  onClick: () => void;
  className?: string;
}

export function AddTransactionButton({
  onClick,
  className,
}: AddTransactionButtonProps) {
  return (
    <Button onClick={onClick} className={cn("premium-cta", className)}>
      <Plus className="size-4" strokeWidth={2.25} />
      Add Transaction
    </Button>
  );
}
