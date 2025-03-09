import {
  Label,
  Listbox,
  ListboxButton,
  ListboxOption,
  ListboxOptions,
} from "@headlessui/react";
import { FaArrowDown } from "react-icons/fa";
import { AggregatedAsset, BridgeableAsset } from "../core";

export function TokenSelect({
  options,
  selected,
  onChange,
  label,
}: {
  options: (AggregatedAsset | BridgeableAsset)[];
  selected: string;
  onChange: (value: string) => void;
  label?: string;
}) {
  const selectedAsset = options.find(
    (asset) => asset.defuse_asset_id === selected,
  );
  return (
    <Listbox value={selected} onChange={onChange}>
      {label && (
        <Label className="block text-sm font-medium text-gray-400">
          {label}
        </Label>
      )}
      <div className="relative mt-1 w-full">
        <ListboxButton
          className="relative w-full cursor-default rounded-md bg-gray-800 
          py-2 pl-3 pr-10 text-left shadow-md border-b border-gray-600 
          focus:border-blue-500 focus:outline-none text-2xl"
        >
          <span className="flex items-center">
            {selectedAsset?.icon && (
              <img
                src={selectedAsset.icon}
                alt=""
                className="h-5 w-5 flex-shrink-0 rounded-full"
              />
            )}
            <span className="ml-3 block truncate">
              {selectedAsset ? selectedAsset.symbol : "Select token"}
            </span>
          </span>
          <span className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-2">
            <FaArrowDown className="h-5 w-5 text-gray-300" aria-hidden="true" />
          </span>
        </ListboxButton>
        <ListboxOptions className="absolute z-10 mt-1 max-h-60 w-full overflow-auto rounded-md bg-gray-700 py-1 text-base shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none">
          {options.map((asset) => (
            <ListboxOption
              key={asset.defuse_asset_id}
              value={asset.defuse_asset_id}
              className={({ selected }) =>
                `relative cursor-default select-none py-2 pl-10 pr-4 ${
                  selected ? "bg-blue-600 text-white" : "text-gray-200"
                }`
              }
            >
              {({ selected: isSelected }) => (
                <span
                  className={`flex items-center ${
                    isSelected ? "font-medium" : "font-normal"
                  }`}
                >
                  {asset.icon && (
                    <img
                      src={asset.icon}
                      alt=""
                      className="h-5 w-5 flex-shrink-0 rounded-full"
                    />
                  )}
                  <span className="ml-3 block truncate">{asset.symbol}</span>
                </span>
              )}
            </ListboxOption>
          ))}
        </ListboxOptions>
      </div>
    </Listbox>
  );
}
