import { useSelect } from "downshift";
import { useState, useEffect } from "react";
import { useConnection } from "state/hooks";
import { useSendForm } from "hooks";
import { isValidAddress, getChainInfo, trackEvent } from "utils";

export default function useAddressSelection() {
  const { isConnected, account } = useConnection();
  const {
    toChain,
    fromChain,
    setToChain,
    setToAddress,
    availableToChains,
    toAddress,
  } = useSendForm();
  const [address, setAddress] = useState("");
  const [open, setOpen] = useState(false);

  const selectedToChainInfo = toChain ? getChainInfo(toChain) : undefined;

  const downshiftState = useSelect({
    items: availableToChains.map((chain) => chain.chainId),
    selectedItem: toChain,
    onSelectedItemChange: ({ selectedItem }) => {
      if (selectedItem) {
        // matomo tracking
        trackEvent({
          category: "send",
          action: "setToChain",
          name: selectedItem.toString(),
        });
        setToChain(selectedItem);
      }
    },
  });

  // keep the address in sync with the form address
  useEffect(() => {
    if (toAddress) {
      setAddress(toAddress);
    }
  }, [toAddress]);
  // modal is closing, reset address to the current toAddress
  const toggle = () => {
    if (!isConnected) return;
    if (open) setAddress(toAddress || address);
    setOpen((prevOpen) => !prevOpen);
  };
  const clearInput = () => {
    setAddress("");
  };

  const handleAddressChange = (evt: React.ChangeEvent<HTMLInputElement>) => {
    setAddress(evt.target.value);
  };
  const isValid = !address || isValidAddress(address);
  const handleSubmit = () => {
    if (isValid) {
      if (address) {
        setToAddress(address);
      } else if (account) {
        setToAddress(account);
      }
      toggle();
    }
  };

  return {
    ...downshiftState,
    handleSubmit,
    handleAddressChange,
    clearInput,
    isValid,
    toAddress,
    toChain,
    fromChain,
    toggle,
    open,
    address,
    isConnected,
    availableToChains,
    selectedToChainInfo,
  };
}
