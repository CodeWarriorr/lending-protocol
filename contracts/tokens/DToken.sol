// SPDX-License-Identifier: MIT
pragma solidity ^0.8.4;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
// import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/Context.sol";
import "../LendingProtocol.sol";

/**
 * @dev Debt Token
 * TODO: MAKE SURE THAT CORE FUNCTIONS OF ERC20 MAKES SENSE
 * TODO: block all transfers
 */
contract DToken is Context, IERC20 {
    // using SafeERC20 for ERC20;

    uint256 private constant rateDecimals = 10**9;

    mapping(address => uint256) private _balances;

    mapping(address => mapping(address => uint256)) private _allowances;

    uint256 private _totalSupply;

    string private _name;
    string private _symbol;

    LendingProtocol private _lendingProtocol;
    address private _underlyingAsset;

    modifier onlyLendingProtocol() {
        require(
            msg.sender == address(_lendingProtocol),
            "RToken: Only Lending Protocol allowed"
        );
        _;
    }

    constructor(
        LendingProtocol lendingProtocol_,
        address underlyingAsset_,
        string memory name_,
        string memory symbol_
    ) {
        _lendingProtocol = lendingProtocol_;
        _underlyingAsset = underlyingAsset_;
        _name = name_;
        _symbol = symbol_;
    }

    /**
     * @dev
     */
    function burn(address account, uint256 amount)
        external
        onlyLendingProtocol
        returns (bool)
    {
        _burn(account, amount);

        return balanceOf(account) == 0;
    }

    /**
     * @dev
     */
    function mint(
        address account,
        uint256 amount,
        uint256 currentRate
    ) external onlyLendingProtocol returns (bool) {
        uint256 balanceBefore = balanceOf(account);

        uint256 amountBeforeRate = (amount * rateDecimals) / currentRate;

        _mint(account, amountBeforeRate);

        return balanceBefore == 0;
    }

    /**
     * @dev
     */
    function getRateDecimals() external pure returns (uint256) {
        return rateDecimals;
    }

    /**
     * @dev
     */
    function getUnderlyingAsset() external view returns (address) {
        return _underlyingAsset;
    }

    /**
     * @dev Returns the name of the token.
     */
    function name() public view virtual returns (string memory) {
        return _name;
    }

    /**
     * @dev Returns the symbol of the token, usually a shorter version of the
     * name.
     */
    function symbol() public view virtual returns (string memory) {
        return _symbol;
    }

    /**
     * @dev
     */
    function decimals() public view virtual returns (uint8) {
        return 18;
    }

    /**
     * @dev See {IERC20-totalSupply}.
     */
    function totalSupply() public view virtual override returns (uint256) {
        return
            (_totalSupply * rateDecimals) /
            _lendingProtocol.getInterestRate(_underlyingAsset);
    }

    /**
     * @dev See {IERC20-balanceOf}.
     */
    function balanceOf(address account)
        public
        view
        virtual
        override
        returns (uint256)
    {
        return
            (_balances[account] * rateDecimals) /
            _lendingProtocol.getBorrowRate(_underlyingAsset);
    }

    /**
     * @dev See {IERC20-transfer}.
     *
     * Requirements:
     *
     * - `to` cannot be the zero address.
     * - the caller must have a balance of at least `amount`.
     */
    function transfer(address to, uint256 amount)
        public
        virtual
        override
        returns (bool)
    {
        to;
        amount;
        require(false, "TRANSFER_NOT_SUPPORTED");
        return false;
    }

    /**
     * @dev See {IERC20-allowance}.
     */
    function allowance(address owner, address spender)
        external
        view
        virtual
        override
        returns (uint256)
    {
        owner;
        spender;
        require(false, "ALLOWANCE_NOT_SUPPORTED");
        return 0;
    }

    /**
     * @dev See {IERC20-approve}.
     *
     * NOTE: If `amount` is the maximum `uint256`, the allowance is not updated on
     * `transferFrom`. This is semantically equivalent to an infinite approval.
     *
     * Requirements:
     *
     * - `spender` cannot be the zero address.
     */
    function approve(address spender, uint256 amount)
        external
        pure
        override
        returns (bool)
    {
        spender;
        amount;
        require(false, "APPROVE_NOT_SUPPORTED");
        return false;
    }

    /**
     * @dev See {IERC20-transferFrom}.
     *
     * Emits an {Approval} event indicating the updated allowance. This is not
     * required by the EIP. See the note at the beginning of {ERC20}.
     *
     * NOTE: Does not update the allowance if the current allowance
     * is the maximum `uint256`.
     *
     * Requirements:
     *
     * - `from` and `to` cannot be the zero address.
     * - `from` must have a balance of at least `amount`.
     * - the caller must have allowance for ``from``'s tokens of at least
     * `amount`.
     */
    function transferFrom(
        address from,
        address to,
        uint256 amount
    ) public virtual override returns (bool) {
        from;
        to;
        amount;
        require(false, "TRANSFER_FROM_NOT_SUPPORTED");
        return false;
    }

    /**
     * @dev Atomically increases the allowance granted to `spender` by the caller.
     *
     * This is an alternative to {approve} that can be used as a mitigation for
     * problems described in {IERC20-approve}.
     *
     * Emits an {Approval} event indicating the updated allowance.
     *
     * Requirements:
     *
     * - `spender` cannot be the zero address.
     */
    function increaseAllowance(address spender, uint256 addedValue)
        public
        virtual
        returns (bool)
    {
        spender;
        addedValue;
        require(false, "INCREASE_ALLOWANCE_NOT_SUPPORTED");
        return false;
    }

    /**
     * @dev Atomically decreases the allowance granted to `spender` by the caller.
     *
     * This is an alternative to {approve} that can be used as a mitigation for
     * problems described in {IERC20-approve}.
     *
     * Emits an {Approval} event indicating the updated allowance.
     *
     * Requirements:
     *
     * - `spender` cannot be the zero address.
     * - `spender` must have allowance for the caller of at least
     * `subtractedValue`.
     */
    function decreaseAllowance(address spender, uint256 subtractedValue)
        public
        virtual
        returns (bool)
    {
        spender;
        subtractedValue;
        require(false, "DECREASED_ALLOWANCE_NOT_SUPPORTED");
        return false;
    }

    // /**
    //  * @dev Moves `amount` of tokens from `sender` to `recipient`.
    //  *
    //  * This internal function is equivalent to {transfer}, and can be used to
    //  * e.g. implement automatic token fees, slashing mechanisms, etc.
    //  *
    //  * Emits a {Transfer} event.
    //  *
    //  * Requirements:
    //  *
    //  * - `from` cannot be the zero address.
    //  * - `to` cannot be the zero address.
    //  * - `from` must have a balance of at least `amount`.
    //  */
    // function _transfer(
    //     address from,
    //     address to,
    //     uint256 amount
    // ) internal virtual {
    //     require(from != address(0), "ERC20: transfer from the zero address");
    //     require(to != address(0), "ERC20: transfer to the zero address");

    //     _beforeTokenTransfer(from, to, amount);

    //     uint256 fromBalance = _balances[from];
    //     require(
    //         fromBalance >= amount,
    //         "ERC20: transfer amount exceeds balance"
    //     );
    //     unchecked {
    //         _balances[from] = fromBalance - amount;
    //     }
    //     _balances[to] += amount;

    //     emit Transfer(from, to, amount);

    //     _afterTokenTransfer(from, to, amount);
    // }

    /** @dev Creates `amount` tokens and assigns them to `account`, increasing
     * the total supply.
     *
     * Emits a {Transfer} event with `from` set to the zero address.
     *
     * Requirements:
     *
     * - `account` cannot be the zero address.
     */
    function _mint(address account, uint256 amount) internal virtual {
        require(account != address(0), "ERC20: mint to the zero address");

        _beforeTokenTransfer(address(0), account, amount);

        _totalSupply += amount;
        _balances[account] += amount;
        emit Transfer(address(0), account, amount);

        _afterTokenTransfer(address(0), account, amount);
    }

    /**
     * @dev Destroys `amount` tokens from `account`, reducing the
     * total supply.
     *
     * Emits a {Transfer} event with `to` set to the zero address.
     *
     * Requirements:
     *
     * - `account` cannot be the zero address.
     * - `account` must have at least `amount` tokens.
     */
    function _burn(address account, uint256 amount) internal virtual {
        require(account != address(0), "ERC20: burn from the zero address");

        _beforeTokenTransfer(account, address(0), amount);

        uint256 accountBalance = _balances[account];
        require(accountBalance >= amount, "ERC20: burn amount exceeds balance");
        unchecked {
            _balances[account] = accountBalance - amount;
        }
        _totalSupply -= amount;

        emit Transfer(account, address(0), amount);

        _afterTokenTransfer(account, address(0), amount);
    }

    /**
     * @dev Sets `amount` as the allowance of `spender` over the `owner` s tokens.
     *
     * This internal function is equivalent to `approve`, and can be used to
     * e.g. set automatic allowances for certain subsystems, etc.
     *
     * Emits an {Approval} event.
     *
     * Requirements:
     *
     * - `owner` cannot be the zero address.
     * - `spender` cannot be the zero address.
     */
    function _approve(
        address owner,
        address spender,
        uint256 amount
    ) internal virtual {
        require(owner != address(0), "ERC20: approve from the zero address");
        require(spender != address(0), "ERC20: approve to the zero address");

        _allowances[owner][spender] = amount;
        emit Approval(owner, spender, amount);
    }

    // /**
    //  * @dev Spend `amount` form the allowance of `owner` toward `spender`.
    //  *
    //  * Does not update the allowance amount in case of infinite allowance.
    //  * Revert if not enough allowance is available.
    //  *
    //  * Might emit an {Approval} event.
    //  */
    // function _spendAllowance(
    //     address owner,
    //     address spender,
    //     uint256 amount
    // ) internal virtual {
    //     uint256 currentAllowance = allowance(owner, spender);
    //     if (currentAllowance != type(uint256).max) {
    //         require(
    //             currentAllowance >= amount,
    //             "ERC20: insufficient allowance"
    //         );
    //         unchecked {
    //             _approve(owner, spender, currentAllowance - amount);
    //         }
    //     }
    // }

    /**
     * @dev Hook that is called before any transfer of tokens. This includes
     * minting and burning.
     *
     * Calling conditions:
     *
     * - when `from` and `to` are both non-zero, `amount` of ``from``'s tokens
     * will be transferred to `to`.
     * - when `from` is zero, `amount` tokens will be minted for `to`.
     * - when `to` is zero, `amount` of ``from``'s tokens will be burned.
     * - `from` and `to` are never both zero.
     *
     * To learn more about hooks, head to xref:ROOT:extending-contracts.adoc#using-hooks[Using Hooks].
     */
    function _beforeTokenTransfer(
        address from,
        address to,
        uint256 amount
    ) internal virtual {}

    /**
     * @dev Hook that is called after any transfer of tokens. This includes
     * minting and burning.
     *
     * Calling conditions:
     *
     * - when `from` and `to` are both non-zero, `amount` of ``from``'s tokens
     * has been transferred to `to`.
     * - when `from` is zero, `amount` tokens have been minted for `to`.
     * - when `to` is zero, `amount` of ``from``'s tokens have been burned.
     * - `from` and `to` are never both zero.
     *
     * To learn more about hooks, head to xref:ROOT:extending-contracts.adoc#using-hooks[Using Hooks].
     */
    function _afterTokenTransfer(
        address from,
        address to,
        uint256 amount
    ) internal virtual {}
}
