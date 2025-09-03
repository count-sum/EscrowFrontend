#![allow(unexpected_cfgs)]

use anchor_lang::prelude::*;
use handlers::*;

pub mod constants;
pub mod error;
pub mod handlers;
pub mod state;

declare_id!("4XLs7eTjECzLwby7D9SwWbSZa9BjFvMrDZb7zEaVNC5k");

#[program]
pub mod escrow {
    use super::*;

    pub fn make_offer(
        context: Context<MakeOffer>,
        id: u64,
        token_a_offered_amount: u64,
        token_b_wanted_amount: u64,
    ) -> Result<()> {
        handlers::make_offer::make_offer(context, id, token_a_offered_amount, token_b_wanted_amount)
    }

    pub fn take_offer(context: Context<TakeOffer>) -> Result<()> {
        handlers::take_offer::take_offer(context)
    }

    pub fn refund_offer(context: Context<RefundOffer>) -> Result<()> {
        handlers::refund_offer::refund_offer(context)
    }
}
