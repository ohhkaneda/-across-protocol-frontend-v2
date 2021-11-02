import { FC, ChangeEvent, useState, useCallback, useEffect } from "react";
import { onboard } from "utils";
import { useConnection } from "state/hooks";
import {
  RoundBox,
  MaxButton,
  Input,
  FormButton,
  InputGroup,
  FormHeader,
  Balance,
} from "./AddLiquidityForm.styles";
import { poolClient } from "state/poolsApi";
import { toWeiSafe } from "utils/weiMath";
import { useERC20 } from "hooks";
import { ethers } from "ethers";
import { clients } from "@uma/sdk";
import { addEtherscan } from "utils/notify";
import BouncingDotsLoader from "components/BouncingDotsLoader";

// max uint value is 2^256 - 1
const MAX_UINT_VAL = ethers.constants.MaxUint256;
const INFINITE_APPROVAL_AMOUNT = MAX_UINT_VAL;

interface Props {
  error: Error | undefined;
  amount: string;
  onChange: (event: ChangeEvent<HTMLInputElement>) => void;
  bridgeAddress: string;
  decimals: number;
  symbol: string;
  tokenAddress: string;
  setShowSuccess: React.Dispatch<React.SetStateAction<boolean>>;
  setDepositUrl: React.Dispatch<React.SetStateAction<string>>;
  balance: ethers.BigNumber;
  setAmount: React.Dispatch<React.SetStateAction<string>>;
}

const AddLiquidityForm: FC<Props> = ({
  error,
  amount,
  onChange,
  bridgeAddress,
  decimals,
  symbol,
  tokenAddress,
  setShowSuccess,
  setDepositUrl,
  balance,
  setAmount,
}) => {
  const { init } = onboard;
  const { isConnected, provider, signer, notify, account } = useConnection();
  const { approve } = useERC20(tokenAddress);

  const [userNeedsToApprove, setUserNeedsToApprove] = useState(false);
  const [txSubmitted, setTxSubmitted] = useState(false);

  const checkIfUserHasToApprove = useCallback(async () => {
    if (signer && account) {
      try {
        const token = clients.erc20.connect(tokenAddress, signer);
        const allowance = await token.allowance(account, bridgeAddress);

        const hasToApprove = allowance.lt(balance);
        if (hasToApprove) {
          setUserNeedsToApprove(true);
        }
      } catch (err) {
        console.log("err in check approval call", err);
      }
    }
  }, [account, tokenAddress, bridgeAddress, signer, balance]);

  useEffect(() => {
    if (isConnected && symbol !== "ETH") checkIfUserHasToApprove();
  }, [isConnected, symbol, checkIfUserHasToApprove]);

  const handleApprove = async () => {
    const tx = await approve({
      amount: INFINITE_APPROVAL_AMOUNT,
      spender: bridgeAddress,
      signer,
    });

    if (tx) {
      setTxSubmitted(true);
      const { emitter } = notify.hash(tx.hash);
      emitter.on("all", addEtherscan);

      emitter.on("txConfirmed", () => {
        setTxSubmitted(false);
        setUserNeedsToApprove(false);
      });

      emitter.on("txError", () => {
        setTxSubmitted(false);
      });
    }
  };

  const approveOrPoolTransactionHandler = async () => {
    if (!provider) {
      return init();
    }
    if (isConnected && userNeedsToApprove) return handleApprove();
    if (isConnected && Number(amount) > 0 && signer) {
      const weiAmount = toWeiSafe(amount, decimals);

      try {
        let txId;
        if (symbol === "ETH") {
          txId = await poolClient.addEthLiquidity(
            signer,
            bridgeAddress,
            weiAmount
          );
        } else {
          txId = await poolClient.addTokenLiquidity(
            signer,
            bridgeAddress,
            weiAmount
          );
        }

        const transaction = poolClient.getTx(txId);

        if (transaction.hash) {
          setTxSubmitted(true);

          const { emitter } = notify.hash(transaction.hash);
          emitter.on("all", addEtherscan);
          // Scope to closure.
          const acc = account;
          emitter.on("txConfirmed", (tx: any) => {
            setTxSubmitted(false);
            setShowSuccess(true);
            const url = `https://etherscan.io/tx/${transaction.hash}`;
            setDepositUrl(url);
            // Nodes are out of sync. Update state in 30 secounds
            setTimeout(() => {
              poolClient.updatePool(bridgeAddress);
              if (acc) {
                poolClient.updateUser(acc, bridgeAddress);
              }
            }, 30000);
          });
          emitter.on("txError", () => {
            setTxSubmitted(false);
          });
        }

        return transaction;
      } catch (err) {
        console.error("err in AddEthLiqudity call", err);
      }
    }
  };

  return (
    <>
      <FormHeader>Amount</FormHeader>

      <InputGroup>
        <RoundBox
          as="label"
          htmlFor="amount"
          style={{
            // @ts-expect-error TS does not likes custom CSS vars
            "--color": error
              ? "var(--color-error-light)"
              : "var(--color-white)",
            "--outline-color": error
              ? "var(--color-error)"
              : "var(--color-primary)",
          }}
        >
          <MaxButton
            onClick={() => {
              if (symbol === "ETH") {
                const removeApproxMaxGas = toWeiSafe("0.1");
                setAmount(
                  ethers.utils.formatEther(balance.sub(removeApproxMaxGas))
                );
              } else {
                setAmount(ethers.utils.formatUnits(balance, decimals));
              }
            }}
            disabled={!isConnected}
          >
            max
          </MaxButton>
          <Input
            placeholder="0.00"
            id="amount"
            value={amount}
            onChange={onChange}
            disabled={!isConnected}
          />
        </RoundBox>
      </InputGroup>
      <Balance>
        <span>
          Balance: {ethers.utils.formatUnits(balance, decimals)} {symbol}
        </span>
      </Balance>
      <FormButton
        onClick={() =>
          approveOrPoolTransactionHandler().catch((err) =>
            console.error("Error on click to approve or pool tx", err)
          )
        }
      >
        {!isConnected
          ? "Connect wallet"
          : userNeedsToApprove
          ? "Approve"
          : "Add liquidity"}
        {txSubmitted ? <BouncingDotsLoader /> : null}
      </FormButton>
    </>
  );
};

export default AddLiquidityForm;